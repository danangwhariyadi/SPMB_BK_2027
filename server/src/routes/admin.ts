import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { db, dbNow } from '../db';
import { requireAuth, requirePerm } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { ROLES, PERMISSIONS } from '../middleware/rbac';
import { exportExcel } from '../services/export/excel';

const router = Router();
router.use(requireAuth);

// ===== MANAJEMEN PENGGUNA =====
router.get('/users', requirePerm('pengguna', 'view'), async (req: Request, res: Response) => {
  const rows = await db.all('SELECT id, username, full_name, role_code, is_active, last_login_at, created_at FROM users ORDER BY id ASC');
  // Ketua tidak dapat melihat pengguna dengan hak akses admin
  const filtered = req.user!.role_code === 'ketua' ? rows.filter(r => r.role_code !== 'admin') : rows;
  res.json({ rows: filtered, roles: ROLES });
});

router.post('/users', requirePerm('pengguna', 'create'), async (req: Request, res: Response) => {
  const { username, password, full_name, role_code } = req.body || {};
  if (!username || !password || !full_name || !ROLES[role_code]) {
    return res.status(400).json({ error: 'Data tidak lengkap atau peran tidak dikenal.' });
  }
  if (String(password).length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
  // Ketua tidak boleh membuat akun admin
  if (req.user!.role_code !== 'admin' && role_code === 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator dapat membuat akun admin.' });
  }
  const exists = await db.get('SELECT id FROM users WHERE username=?', [String(username).trim()]);
  if (exists) return res.status(409).json({ error: 'Username sudah digunakan.' });
  const hash = await bcrypt.hash(String(password), 10);
  const r = await db.write(
    'INSERT INTO users (username, password_hash, full_name, role_code, created_at, updated_at) VALUES (?,?,?,?,?,?)',
    [String(username).trim(), hash, String(full_name).slice(0, 120), role_code, dbNow(), dbNow()],
    'users'
  );
  await audit(req, 'tambah_pengguna', 'users', r.lastID ?? null, `${username} (${role_code})`);
  res.json({ ok: true, id: r.lastID });
});

router.put('/users/:id', requirePerm('pengguna', 'edit'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = await db.get('SELECT * FROM users WHERE id=?', [id]);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (req.user!.role_code !== 'admin' && (user.role_code === 'admin' || req.body.role_code === 'admin')) {
    return res.status(403).json({ error: 'Tidak diizinkan mengubah akun admin.' });
  }
  const { full_name, role_code, is_active, password } = req.body || {};
  const changes: string[] = [];
  let params: any[] = [];
  let sql = 'UPDATE users SET updated_at=?';
  params.push(dbNow());
  if (full_name) { sql += ', full_name=?'; params.push(String(full_name).slice(0, 120)); changes.push('nama'); }
  if (role_code && ROLES[role_code]) { sql += ', role_code=?'; params.push(role_code); changes.push(`peran -> ${role_code}`); }
  if (is_active !== undefined) { sql += ', is_active=?'; params.push(is_active ? 1 : 0); changes.push(is_active ? 'diaktifkan' : 'dinonaktifkan'); }
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });
    sql += ', password_hash=?, failed_attempts=0, locked_until=NULL';
    params.push(await bcrypt.hash(String(password), 10));
    changes.push('password direset');
  }
  sql += ' WHERE id=?';
  params.push(id);
  await db.write(sql, params, 'users', String(id));
  await audit(req, 'edit_pengguna', 'users', id, `${user.username}: ${changes.join(', ')}`);
  res.json({ ok: true });
});

router.delete('/users/:id', requirePerm('pengguna', 'delete'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = await db.get('SELECT * FROM users WHERE id=?', [id]);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (user.role_code === 'admin') return res.status(403).json({ error: 'Akun admin tidak dapat dihapus.' });
  if (user.id === req.user!.id) return res.status(400).json({ error: 'Tidak dapat menghapus akun sendiri.' });
  await db.write('DELETE FROM users WHERE id=?', [id], 'users', String(id));
  await audit(req, 'hapus_pengguna', 'users', id, user.username);
  res.json({ ok: true });
});

// ===== GELOMBANG =====
router.get('/waves', requirePerm('pendaftaran', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all(
    `SELECT w.*, (SELECT COUNT(*) FROM applicants a WHERE a.wave_id=w.id AND a.registration_number IS NOT NULL) AS used FROM registration_waves w ORDER BY w.start_date ASC`
  );
  res.json({ rows });
});

router.post('/waves', requirePerm('pengaturan', 'create'), async (req: Request, res: Response) => {
  const { nama, start_date, end_date, is_active = 1, quota_tm = 0, quota_to = 0, quota_pplg = 0 } = req.body || {};
  if (!nama || !start_date || !end_date) return res.status(400).json({ error: 'Nama dan tanggal wajib diisi.' });
  const r = await db.write(
    'INSERT INTO registration_waves (nama, start_date, end_date, is_active, quota_tm, quota_to, quota_pplg, ta, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [String(nama).slice(0, 80), start_date, end_date, is_active ? 1 : 0, Number(quota_tm) || 0, Number(quota_to) || 0, Number(quota_pplg) || 0, config_ta(), dbNow(), dbNow()],
    'registration_waves'
  );
  await audit(req, 'tambah_gelombang', 'registration_waves', r.lastID ?? null, nama);
  res.json({ ok: true, id: r.lastID });
});

router.put('/waves/:id', requirePerm('pengaturan', 'edit'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const w = await db.get('SELECT * FROM registration_waves WHERE id=?', [id]);
  if (!w) return res.status(404).json({ error: 'Gelombang tidak ditemukan' });
  const { nama, start_date, end_date, is_active, quota_tm, quota_to, quota_pplg } = req.body || {};
  await db.write(
    'UPDATE registration_waves SET nama=?, start_date=?, end_date=?, is_active=?, quota_tm=?, quota_to=?, quota_pplg=?, updated_at=? WHERE id=?',
    [nama ?? w.nama, start_date ?? w.start_date, end_date ?? w.end_date,
      is_active !== undefined ? (is_active ? 1 : 0) : w.is_active,
      quota_tm !== undefined ? Number(quota_tm) : w.quota_tm,
      quota_to !== undefined ? Number(quota_to) : w.quota_to,
      quota_pplg !== undefined ? Number(quota_pplg) : w.quota_pplg,
      dbNow(), id],
    'registration_waves', String(id)
  );
  await audit(req, 'edit_gelombang', 'registration_waves', id, nama || w.nama);
  res.json({ ok: true });
});

router.delete('/waves/:id', requirePerm('pengaturan', 'delete'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const used = await db.get('SELECT COUNT(*) AS c FROM applicants WHERE wave_id=?', [id]);
  if ((used?.c ?? 0) > 0) return res.status(400).json({ error: 'Gelombang sudah memiliki pendaftar; nonaktifkan saja.' });
  await db.write('DELETE FROM registration_waves WHERE id=?', [id], 'registration_waves', String(id));
  await audit(req, 'hapus_gelombang', 'registration_waves', id, '');
  res.json({ ok: true });
});

function config_ta(): string {
  return process.env.TA || '2027/2028';
}

// ===== PENGATURAN SISTEM =====
const SETTING_KEYS = [
  'school_name', 'school_address', 'school_phone', 'school_email', 'school_website',
  'ta', 'pendaftaran_dibuka', 'info_spmd', 'info_spmb', 'format_no_pendaftaran',
  'umur_ref_date', 'scanner_bridge_token', 'scanner_bridge_url', 'biaya_gelombang',
];

router.get('/settings', requirePerm('pengaturan', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT skey, svalue FROM school_settings');
  res.json({ settings: Object.fromEntries(rows.map(r => [r.skey, r.svalue])), keys: SETTING_KEYS });
});

router.put('/settings', requirePerm('pengaturan', 'edit'), async (req: Request, res: Response) => {
  const entries = Object.entries(req.body || {}).filter(([k]) => SETTING_KEYS.includes(k));
  for (const [k, v] of entries) {
    const exists = await db.get('SELECT skey FROM school_settings WHERE skey=?', [k]);
    if (exists) {
      await db.write('UPDATE school_settings SET svalue=? WHERE skey=?', [String(v), k], 'school_settings', k);
    } else {
      await db.write('INSERT INTO school_settings (skey, svalue) VALUES (?,?)', [k, String(v)], 'school_settings', k);
    }
  }
  await audit(req, 'ubah_pengaturan', 'school_settings', null, Object.keys(entries).join(', '));
  res.json({ ok: true });
});

// ===== AUDIT LOG =====
router.get('/audit', requirePerm('audit', 'view'), async (req: Request, res: Response) => {
  const { page = '1', limit = '50', q = '' } = req.query as any;
  const lim = Math.min(200, parseInt(limit, 10));
  const off = (Math.max(1, parseInt(page, 10)) - 1) * lim;
  const where = q ? 'WHERE (username LIKE ? OR action LIKE ? OR detail LIKE ? OR entity LIKE ?)' : '';
  const params = q ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : [];
  const total = (await db.get(`SELECT COUNT(*) AS c FROM audit_logs ${where}`, params))?.c ?? 0;
  const rows = await db.all(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`, params);
  res.json({ total, rows });
});

// ===== BACKUP =====
router.get('/backup', requirePerm('backup', 'view'), async (req: Request, res: Response) => {
  const { dbManager } = { dbManager: (await import('../db')).db };
  const tables = ['users', 'roles', 'permissions', 'applicants', 'applicant_parents', 'applicant_guardians',
    'applicant_achievements', 'applicant_tka_scores', 'applicant_preferences', 'applicant_documents',
    'registration_waves', 'registration_sequences', 'health_examinations', 'interviews', 'interview_answers',
    'interview_questions', 'document_verifications', 'fee_types', 'payments', 'payment_items',
    'registration_status_history', 'audit_logs', 'school_settings'];
  const dump: Record<string, any[]> = {};
  for (const t of tables) {
    try { dump[t] = await db.all(`SELECT * FROM ${t}`); } catch { dump[t] = []; }
  }
  await audit(req, 'backup_database', 'database', null, `Ekspor ${tables.length} tabel`);
  res.setHeader('Content-Disposition', `attachment; filename="backup-spmb-${dbNow().slice(0, 10)}.json"`);
  res.json({ meta: { created_at: dbNow(), ta: config_ta(), tables: tables.length }, data: dump });
});

// ===== LAPORAN =====
async function runReport(type: string, q: any): Promise<{ header: string[]; rows: any[] } | null> {
  const { from = '', to = '', wave = '', program = '' } = q;
  const conds: string[] = ['registration_number IS NOT NULL'];
  const params: any[] = [];
  if (from) { conds.push('substr(registration_date,1,10) >= ?'); params.push(from); }
  if (to) { conds.push('substr(registration_date,1,10) <= ?'); params.push(to); }
  if (wave) { conds.push('wave_id=?'); params.push(wave); }
  if (program) { conds.push('program_keahlian=?'); params.push(program); }
  const W = conds.join(' AND ');

  let header: string[] = [];
  let rows: any[] = [];
  switch (type) {
    case 'keseluruhan':
      header = ['No. Pendaftaran', 'Tanggal', 'Nama', 'NISN', 'Program Keahlian', 'Gelombang', 'Status Akhir'];
      rows = await db.all(
        `SELECT a.registration_number, substr(a.registration_date,1,10) AS tgl, a.nama_lengkap, a.nisn, a.program_keahlian,
                COALESCE(w.nama,'-') AS wave, a.status_akhir
         FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id WHERE ${W} ORDER BY a.registration_number`, params);
      rows = rows.map(r => [r.registration_number, r.tgl, r.nama_lengkap, r.nisn, r.program_keahlian, r.wave, r.status_akhir]);
      break;
    case 'gelombang':
      header = ['Gelombang', 'Jumlah Pendaftar'];
      rows = await db.all(
        `SELECT COALESCE(w.nama,'-') AS gel, COUNT(*) AS total FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id WHERE ${W} GROUP BY a.wave_id ORDER BY gel`, params);
      rows = rows.map(r => [r.gel, r.total]);
      break;
    case 'program':
      header = ['Program Keahlian', 'Jumlah Pendaftar'];
      rows = await db.all(`SELECT program_keahlian, COUNT(*) AS total FROM applicants WHERE ${W} GROUP BY program_keahlian ORDER BY total DESC`, params);
      break;
    case 'asal-sekolah':
      header = ['Asal Sekolah', 'Kecamatan', 'Jumlah'];
      rows = await db.all(`SELECT asal_sekolah, COALESCE(asal_kecamatan,'-') AS kec, COUNT(*) AS total FROM applicants WHERE ${W} GROUP BY asal_sekolah, asal_kecamatan ORDER BY total DESC`, params);
      rows = rows.map(r => [r.asal_sekolah, r.kec, r.total]);
      break;
    case 'kecamatan':
      header = ['Kecamatan', 'Jumlah Pendaftar'];
      rows = await db.all(`SELECT COALESCE(kecamatan,'-') AS kec, COUNT(*) AS total FROM applicants WHERE ${W} GROUP BY kecamatan ORDER BY total DESC`, params);
      rows = rows.map(r => [r.kec, r.total]);
      break;
    case 'dokumen':
      header = ['No. Pendaftaran', 'Nama', 'Dokumen Kurang'];
      rows = await db.all(
        `SELECT a.registration_number, a.nama_lengkap,
          (6 - (SELECT COUNT(*) FROM applicant_documents d WHERE d.applicant_id=a.id AND d.status='Ada' AND d.doc_type IN ('kk','akta','transkrip','ijazah','nisn','foto'))) AS kurang
         FROM applicants a WHERE ${W} HAVING kurang > 0 ORDER BY a.registration_number`, params);
      break;
    case 'kesehatan':
      header = ['No. Pendaftaran', 'Nama', 'Berat (kg)', 'Tinggi (cm)', 'Buta Warna', 'Penglihatan', 'Status'];
      rows = await db.all(
        `SELECT a.registration_number, a.nama_lengkap, h.berat_badan, h.tinggi_badan, h.buta_warna, h.penglihatan, h.status
         FROM health_examinations h JOIN applicants a ON a.id=h.applicant_id WHERE ${W.replace(/registration_date/g, 'a.registration_date')} ORDER BY a.registration_number`, params);
      break;
    case 'wawancara':
      header = ['No. Pendaftaran', 'Nama', 'Rekomendasi', 'Status'];
      rows = await db.all(
        `SELECT a.registration_number, a.nama_lengkap, i.rekomendasi, i.status
         FROM interviews i JOIN applicants a ON a.id=i.applicant_id WHERE ${W.replace(/registration_date/g, 'a.registration_date')} ORDER BY a.registration_number`, params);
      break;
    case 'verifikasi':
      header = ['No. Pendaftaran', 'Nama', 'Status Verifikasi', 'Status Berkas'];
      rows = await db.all(`SELECT registration_number, nama_lengkap, status_verifikasi, status_berkas FROM applicants WHERE ${W} ORDER BY registration_number`, params);
      break;
    case 'akhir':
      header = ['No. Pendaftaran', 'Nama', 'Program Keahlian', 'Status Akhir'];
      rows = await db.all(`SELECT registration_number, nama_lengkap, program_keahlian, status_akhir FROM applicants WHERE ${W} ORDER BY registration_number`, params);
      break;
    case 'seragam':
      header = ['Ukuran', 'Jumlah'];
      rows = await db.all(`SELECT COALESCE(uniform_size,'-') AS uk, COUNT(*) AS total FROM applicants WHERE ${W} GROUP BY uniform_size ORDER BY uk`, params);
      rows = rows.map(r => [r.uk, r.total]);
      break;
    default:
      return null;
  }
  return { header, rows };
}

router.get('/reports/:type', requirePerm('laporan', 'view'), async (req: Request, res: Response) => {
  const type = req.params.type;
  const data = await runReport(type, req.query as any);
  if (!data) return res.status(400).json({ error: 'Jenis laporan tidak dikenal.' });
  const meta = { type, title: REPORT_TITLES[type] || type, generated_at: dbNow(), filter: req.query };
  res.json({ meta, header: data.header, rows: data.rows });
});

const REPORT_TITLES: Record<string, string> = {
  keseluruhan: 'Rekap Pendaftar Keseluruhan',
  gelombang: 'Rekap Pendaftar per Gelombang',
  program: 'Rekap Pendaftar per Program Keahlian',
  'asal-sekolah': 'Rekap Asal Sekolah',
  kecamatan: 'Rekap Pendaftar per Kecamatan',
  dokumen: 'Rekap Dokumen Belum Lengkap',
  kesehatan: 'Rekap Hasil Kesehatan',
  wawancara: 'Rekap Hasil Wawancara',
  verifikasi: 'Rekap Hasil Verifikasi',
  akhir: 'Rekap Hasil Akhir Penerimaan',
  seragam: 'Rekap Ukuran Seragam',
};

// Export Excel laporan
router.get('/reports/:type/excel', requirePerm('laporan', 'view'), async (req: Request, res: Response) => {
  const { type } = req.params;
  const data = await runReport(type, req.query as any);
  if (!data) return res.status(400).json({ error: 'Jenis laporan tidak dikenal.' });
  const buf = await exportExcel(REPORT_TITLES[type] || type, data.header, data.rows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${type}.xlsx"`);
  res.send(buf);
});

// ===== EXPORT EXCEL DATA PENDAFTAR =====
router.get('/applicants/export', requirePerm('pendaftaran', 'view'), async (req: Request, res: Response) => {
  const { wave = '', program = '', date = '', q = '' } = req.query as any;
  const where: string[] = ['registration_number IS NOT NULL'];
  const params: any[] = [];
  if (wave) { where.push('wave_id=?'); params.push(wave); }
  if (program) { where.push('program_keahlian=?'); params.push(program); }
  if (date) { where.push('substr(registration_date,1,10)=?'); params.push(date); }
  if (q) { where.push('(nama_lengkap LIKE ? OR registration_number LIKE ? OR nisn LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await db.all(
    `SELECT a.registration_number, substr(a.registration_date,1,10) AS tgl, a.nama_lengkap, a.nisn, a.jenis_kelamin,
            a.asal_sekolah, a.kecamatan, a.hp_siswa, a.program_keahlian, COALESCE(w.nama,'-') AS wave,
            a.status_berkas, a.status_kesehatan, a.status_wawancara, a.status_verifikasi, a.status_akhir
     FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id WHERE ${where.join(' AND ')} ORDER BY a.registration_number`,
    params
  );
  const header = ['No. Pendaftaran', 'Tanggal', 'Nama Lengkap', 'NISN', 'JK', 'Asal Sekolah', 'Kecamatan', 'No. HP', 'Program Keahlian', 'Gelombang', 'Berkas', 'Kesehatan', 'Wawancara', 'Verifikasi', 'Status Akhir'];
  const data = rows.map(r => [r.registration_number, r.tgl, r.nama_lengkap, r.nisn, r.jenis_kelamin, r.asal_sekolah, r.kecamatan, r.hp_siswa, r.program_keahlian, r.wave, r.status_berkas, r.status_kesehatan, r.status_wawancara, r.status_verifikasi, r.status_akhir]);
  const buf = await exportExcel('Data Pendaftar', header, data);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="data-pendaftar-${dbNow().slice(0, 10)}.xlsx"`);
  res.send(buf);
});

export default router;
