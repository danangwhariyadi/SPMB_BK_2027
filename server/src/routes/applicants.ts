import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, dbNow } from '../db';
import { requireAuth, requirePerm } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { nextRegistrationNumber, resolveActiveWave } from '../services/sequence';
import { ageAt10July2027, randomPin, isValidIndonesianPhone } from '../util/helpers';
import { config } from '../config';

const router = Router();
router.use(requireAuth);

// ===== Daftar pendaftar (search, filter, sort, pagination) =====
router.get('/', requirePerm('pendaftaran', 'view'), async (req: Request, res: Response) => {
  const { q = '', wave = '', program = '', status = '', date = '', sort = 'id', dir = 'desc', page = '1', limit = '20' } = req.query as any;
  const where: string[] = ['registration_number IS NOT NULL'];
  const params: any[] = [];
  if (q) {
    where.push('(nama_lengkap LIKE ? OR registration_number LIKE ? OR nisn LIKE ? OR asal_sekolah LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (wave) { where.push('wave_id=?'); params.push(wave); }
  if (program) { where.push('program_keahlian=?'); params.push(program); }
  if (status) { where.push('status_admin=?'); params.push(status); }
  if (date) { where.push('substr(registration_date,1,10)=?'); params.push(date); }
  const sortCols: Record<string, string> = {
    id: 'id', nama_lengkap: 'nama_lengkap', registration_number: 'registration_number',
    registration_date: 'registration_date', program_keahlian: 'program_keahlian',
  };
  const orderCol = sortCols[sort] || 'id';
  const orderDir = dir === 'asc' ? 'ASC' : 'DESC';
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const off = (Math.max(1, parseInt(page, 10)) - 1) * lim;
  const whereSql = where.join(' AND ');
  const total = (await db.get(`SELECT COUNT(*) AS c FROM applicants WHERE ${whereSql}`, params))?.c ?? 0;
  const rows = await db.all(
    `SELECT a.*, w.nama AS wave_nama FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id WHERE ${whereSql} ORDER BY ${orderCol} ${orderDir} LIMIT ${lim} OFFSET ${off}`,
    params
  );
  res.json({ total, page: parseInt(page, 10), limit: lim, rows: rows.map(({ pin_hash, ...r }) => r) });
});

router.get('/rekap', requirePerm('pendaftaran', 'view'), async (req: Request, res: Response) => {
  const { wave = '', program = '', date = '' } = req.query as any;
  const where: string[] = ['registration_number IS NOT NULL'];
  const params: any[] = [];
  if (wave) { where.push('wave_id=?'); params.push(wave); }
  if (program) { where.push('program_keahlian=?'); params.push(program); }
  if (date) { where.push('substr(registration_date,1,10)=?'); params.push(date); }
  const rows = await db.all(
    `SELECT a.registration_number, a.registration_date, a.nama_lengkap, a.nisn, a.jenis_kelamin, a.asal_sekolah,
            a.kecamatan, a.hp_siswa, a.program_keahlian, w.nama AS wave_nama, a.status_berkas, a.status_akhir
     FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id WHERE ${where.join(' AND ')} ORDER BY a.registration_number ASC`,
    params
  );
  res.json({ rows });
});

// ===== Detail pendaftar =====
router.get('/:id', requirePerm('pendaftaran', 'view'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const parents = await db.get('SELECT * FROM applicant_parents WHERE applicant_id=?', [id]);
  const guardian = await db.get('SELECT * FROM applicant_guardians WHERE applicant_id=?', [id]);
  const ach = await db.get('SELECT * FROM applicant_achievements WHERE applicant_id=?', [id]);
  const tka = await db.all('SELECT * FROM applicant_tka_scores WHERE applicant_id=?', [id]);
  const prefs = await db.all('SELECT * FROM applicant_preferences WHERE applicant_id=?', [id]);
  const docs = await db.all('SELECT * FROM applicant_documents WHERE applicant_id=?', [id]);
  const health = await db.all('SELECT * FROM health_examinations WHERE applicant_id=? ORDER BY id DESC', [id]);
  const interviews = await db.all('SELECT * FROM interviews WHERE applicant_id=? ORDER BY id DESC', [id]);
  const verifs = await db.all('SELECT * FROM document_verifications WHERE applicant_id=? ORDER BY id DESC', [id]);
  const history = await db.all('SELECT * FROM registration_status_history WHERE applicant_id=? ORDER BY id ASC', [id]);
  const wave = a.wave_id ? await db.get('SELECT nama FROM registration_waves WHERE id=?', [a.wave_id]) : null;
  const payments = await db.all('SELECT * FROM payments WHERE applicant_id=? ORDER BY id DESC', [id]);
  res.json({
    applicant: { ...a, pin_hash: undefined },
    wave: wave?.nama || '',
    parents, guardian, achievements: ach, tka, preferences: prefs, documents: docs,
    health, interviews, verifications: verifs, history, payments,
  });
});

// ===== Input pendaftaran manual oleh panitia =====
router.post('/', requirePerm('pendaftaran', 'create'), async (req: Request, res: Response) => {
  const d = req.body?.data;
  if (!d?.siswa?.nama_lengkap) return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
  if (!['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'].includes(d?.pilihan?.program_keahlian)) {
    return res.status(400).json({ error: 'Program keahlian wajib dipilih.' });
  }
  const wave = (req.body?.wave_id) ? { id: req.body.wave_id, nama: (await db.get('SELECT nama FROM registration_waves WHERE id=?', [req.body.wave_id]))?.nama } : await resolveActiveWave();
  if (!wave) return res.status(403).json({ error: 'Tidak ada gelombang aktif.' });
  const s = d.siswa;
  const umur = ageAt10July2027(s.tanggal_lahir);
  const pin = randomPin(8);
  const pinHash = await bcrypt.hash(pin, 10);
  try {
    const result = await db.transaction(async (tx: any) => {
      const reg = await nextRegistrationNumber(tx);
      const nowIso = dbNow();
      await tx.query(
        `INSERT INTO applicants (registration_number, pin_hash, registration_date, wave_id, ta, jalur, nama_lengkap, nisn, tempat_lahir, tanggal_lahir, jenis_kelamin, agama, alamat, desa, kecamatan, kabupaten, jarak_km, hp_siswa, berat_badan, tinggi_badan, umur_10juli, jenjang_asal, asal_sekolah, asal_kecamatan, asal_kabupaten, no_seri_ijazah, uniform_size, program_keahlian, riwayat_pendaftaran, riwayat_sekolah, riwayat_jurusan, riwayat_tahun, riwayat_status, pernyataan, submitted_at, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [reg.number, pinHash, nowIso, wave.id, config.ta,
          d.prestasi?.memiliki === 'Ya' ? 'Prestasi' : 'Reguler',
          s.nama_lengkap, s.nisn || '', s.tempat_lahir || '', s.tanggal_lahir || '', s.jenis_kelamin || '', s.agama || '',
          s.alamat || '', s.desa || '', s.kecamatan || '', s.kabupaten || '', Number(s.jarak_km) || null,
          s.hp_siswa || '', Number(s.berat_badan) || null, Number(s.tinggi_badan) || null, umur,
          s.jenjang_asal || '', s.asal_sekolah || '', s.asal_kecamatan || '', s.asal_kabupaten || '', s.no_seri_ijazah || '',
          s.uniform_size || '', d.pilihan.program_keahlian,
          d.riwayat?.pernah === true ? 'Pernah' : 'Belum pernah',
          d.riwayat?.pernah ? s.riwayat_sekolah || '' : '', d.riwayat?.pernah ? s.riwayat_jurusan || '' : '',
          d.riwayat?.pernah ? s.riwayat_tahun || '' : '', d.riwayat?.pernah ? s.riwayat_status || '' : '',
          1, nowIso, nowIso, nowIso]
      );
      const applicantId = tx.lastID;
      const o = d.ortu || {};
      await tx.query(
        'INSERT INTO applicant_parents (applicant_id, ayah_nama, ayah_pekerjaan, ayah_hp, ibu_nama, ibu_pekerjaan, ibu_hp, alamat, rt, rw, desa, kecamatan, kabupaten) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [applicantId, o.ayah_nama || '', o.ayah_pekerjaan || '', o.ayah_hp || '', o.ibu_nama || '', o.ibu_pekerjaan || '', o.ibu_hp || '', o.alamat || '', o.rt || '', o.rw || '', o.desa || '', o.kecamatan || '', o.kabupaten || '']
      );
      const w = d.wali || {};
      await tx.query('INSERT INTO applicant_guardians (applicant_id, nama, alamat, rt, rw, pekerjaan, hp, sama_dengan_ortu) VALUES (?,?,?,?,?,?,?,?)',
        [applicantId, w.nama || '', w.alamat || '', w.rt || '', w.rw || '', w.pekerjaan || '', w.hp || '', w.sama_dengan_ortu ? 1 : 0]);
      const p = d.prestasi || {};
      await tx.query('INSERT INTO applicant_achievements (applicant_id, memiliki, nama, tingkat, tahun, keterangan) VALUES (?,?,?,?,?,?)',
        [applicantId, p.memiliki === 'Ya' ? 1 : 0, p.nama || '', p.tingkat || '', p.tahun || '', p.keterangan || '']);
      for (const t of Array.isArray(d.tka) ? d.tka : []) {
        if (!t?.mapel) continue;
        await tx.query('INSERT INTO applicant_tka_scores (applicant_id, jenis, mapel, nilai) VALUES (?,?,?,?)',
          [applicantId, t.jenis === 'pilihan' ? 'pilihan' : 'wajib', String(t.mapel).slice(0, 120), Number(t.nilai) || null]);
      }
      await tx.query('INSERT INTO applicant_preferences (applicant_id, pilihan, program_keahlian) VALUES (?,?,?)',
        [applicantId, 1, d.pilihan.program_keahlian]);
      await tx.query('INSERT INTO registration_status_history (applicant_id, status_from, status_to, changed_by, note, created_at) VALUES (?,?,?,?,?,?)',
        [applicantId, '', 'Pendaftaran Baru', req.user!.username, `Input manual oleh ${req.user!.full_name}`, nowIso]);
      return { applicantId, regNumber: reg.number };
    });
    await audit(req, 'input_pendaftaran', 'applicants', result.applicantId, `Input manual ${s.nama_lengkap} (${result.regNumber})`);
    res.json({ ok: true, id: result.applicantId, registration_number: result.regNumber, pin });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Gagal menyimpan pendaftaran.' });
  }
});

// ===== Edit pendaftar (hak akses edit) =====
router.put('/:id', requirePerm('pendaftaran', 'edit'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const allowed = [
    'nama_lengkap', 'nisn', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'agama', 'alamat', 'desa',
    'kecamatan', 'kabupaten', 'jarak_km', 'hp_siswa', 'berat_badan', 'tinggi_badan', 'jenjang_asal',
    'asal_sekolah', 'asal_kecamatan', 'asal_kabupaten', 'no_seri_ijazah', 'uniform_size', 'program_keahlian',
    'riwayat_pendaftaran', 'riwayat_sekolah', 'riwayat_jurusan', 'riwayat_tahun', 'riwayat_status',
  ];
  const updates: string[] = [];
  const params: any[] = [];
  const changed: string[] = [];
  for (const f of allowed) {
    if (req.body[f] !== undefined && req.body[f] !== a[f]) {
      updates.push(`${f}=?`);
      params.push(req.body[f]);
      changed.push(`${f}: "${a[f]}" -> "${req.body[f]}"`);
    }
  }
  if (!updates.length) return res.json({ ok: true, changed: 0 });
  updates.push('updated_at=?');
  params.push(dbNow(), id);
  await db.write(`UPDATE applicants SET ${updates.join(', ')} WHERE id=?`, params, 'applicants', String(id));
  await db.write(
    'INSERT INTO registration_status_history (applicant_id, status_from, status_to, changed_by, note, created_at) VALUES (?,?,?,?,?,?)',
    [id, a.status_admin, a.status_admin, req.user!.username, `Edit data: ${changed.join('; ')}`.slice(0, 900), dbNow()],
    'registration_status_history'
  );
  await audit(req, 'edit_pendaftar', 'applicants', id, changed.join('; ').slice(0, 900));
  res.json({ ok: true, changed: changed.length });
});

// ===== Hapus pendaftar =====
router.delete('/:id', requirePerm('pendaftaran', 'delete'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  if (String(req.body?.confirm || req.query.confirm || '') !== a.registration_number) {
    return res.status(400).json({ error: 'Konfirmasi hapus: ketik nomor pendaftaran untuk mengonfirmasi.' });
  }
  for (const tbl of ['applicant_parents', 'applicant_guardians', 'applicant_achievements', 'applicant_tka_scores',
    'applicant_preferences', 'applicant_documents', 'health_examinations', 'interviews', 'document_verifications',
    'registration_status_history', 'payments']) {
    await db.write(`DELETE FROM ${tbl} WHERE applicant_id=?`, [id], tbl).catch(() => undefined);
  }
  await db.write('DELETE FROM interview_answers WHERE interview_id NOT IN (SELECT id FROM interviews)', [], 'interview_answers').catch(() => undefined);
  await db.write('DELETE FROM payment_items WHERE payment_id NOT IN (SELECT id FROM payments)', [], 'payment_items').catch(() => undefined);
  await db.write('DELETE FROM applicants WHERE id=?', [id], 'applicants', String(id));
  await audit(req, 'hapus_pendaftar', 'applicants', id, `Hapus ${a.registration_number} - ${a.nama_lengkap}`);
  res.json({ ok: true });
});

// ===== Cetak formulir =====
router.get('/:id/formulir.pdf', requirePerm('pendaftaran', 'view'), async (req: Request, res: Response) => {
  const { renderFormulirPdf } = await import('../services/pdf/formulirService');
  const pdf = await renderFormulirPdf(parseInt(req.params.id, 10));
  if (!pdf) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Formulir-${req.params.id}.pdf"`);
  res.send(Buffer.from(pdf));
});

export default router;
