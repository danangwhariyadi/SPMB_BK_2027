import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth, requirePerm } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/stats', requirePerm('dashboard', 'view'), async (req: Request, res: Response) => {
  const { ta = '', wave = '', program = '', status = '', date = '' } = req.query as any;
  const conds: string[] = ['a.registration_number IS NOT NULL'];
  const params: any[] = [];
  if (ta) { conds.push('a.ta=?'); params.push(ta); }
  if (wave) { conds.push('a.wave_id=?'); params.push(wave); }
  if (program) { conds.push('a.program_keahlian=?'); params.push(program); }
  if (status) { conds.push('a.status_akhir=?'); params.push(status); }
  if (date) { conds.push('substr(a.registration_date,1,10)=?'); params.push(date); }
  const W = conds.join(' AND ');
  const today = new Date().toISOString().slice(0, 10);
  const total = (await db.get(`SELECT COUNT(*) AS c FROM applicants a WHERE ${W}`, params))?.c ?? 0;
  const todayCount = (await db.get(`SELECT COUNT(*) AS c FROM applicants a WHERE ${W} AND substr(a.registration_date,1,10)=?`, [...params, today]))?.c ?? 0;
  const perWave = await db.all(
    `SELECT w.nama, COUNT(a.id) AS total FROM registration_waves w LEFT JOIN applicants a ON a.wave_id=w.id AND ${W} WHERE (a.id IS NULL OR a.registration_number IS NOT NULL) GROUP BY w.id ORDER BY w.start_date`,
    params
  );
  const perProgram = await db.all(
    `SELECT a.program_keahlian, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.program_keahlian`, params
  );
  const perJalur = await db.all(
    `SELECT a.jalur, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.jalur`, params
  );
  const perDay = await db.all(
    `SELECT substr(a.registration_date,1,10) AS tanggal, COUNT(*) AS total FROM applicants a WHERE ${W} AND a.registration_date >= date('now', '-30 days') GROUP BY substr(a.registration_date,1,10) ORDER BY tanggal`, params
  );
  const perMonth = await db.all(
    `SELECT substr(a.registration_date,1,7) AS bulan, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY substr(a.registration_date,1,7) ORDER BY bulan`, params
  );
  const docsIncomplete = (await db.get(
    `SELECT COUNT(DISTINCT a.id) AS c FROM applicants a WHERE ${W} AND (SELECT COUNT(*) FROM applicant_documents d WHERE d.applicant_id=a.id AND d.status='Ada' AND d.doc_type IN ('kk','akta','transkrip','ijazah','nisn','foto')) < 6`, params
  ))?.c ?? 0;
  const waitingVerify = (await db.get(`SELECT COUNT(*) AS c FROM applicants a WHERE ${W} AND a.status_verifikasi IN ('Belum diproses','Sedang diproses')`, params))?.c ?? 0;
  const verified = (await db.get(`SELECT COUNT(*) AS c FROM applicants a WHERE ${W} AND a.status_verifikasi='Disetujui'`, params))?.c ?? 0;
  const perKecamatan = await db.all(
    `SELECT COALESCE(a.kecamatan,'-') AS kecamatan, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.kecamatan ORDER BY total DESC`, params
  );
  const perAsalSekolah = await db.all(
    `SELECT COALESCE(a.asal_sekolah,'-') AS sekolah, COALESCE(a.asal_kecamatan,'-') AS kecamatan, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.asal_sekolah, a.asal_kecamatan ORDER BY total DESC LIMIT 30`, params
  );
  const perDesa = await db.all(
    `SELECT COALESCE(a.desa,'-') AS desa, COALESCE(a.kecamatan,'-') AS kecamatan, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.desa, a.kecamatan ORDER BY total DESC LIMIT 40`, params
  );
  const payments = await db.get('SELECT COUNT(*) AS c, COALESCE(SUM(total),0) AS t FROM payments');
  const uniformSizes = await db.all(
    `SELECT COALESCE(a.uniform_size,'-') AS ukuran, COUNT(*) AS total FROM applicants a WHERE ${W} GROUP BY a.uniform_size`, params
  );
  const canSeePayments = ['admin', 'ketua', 'bendahara'].includes(req.user!.role_code);
  res.json({
    filters: { ta, wave, program, status, date },
    total, today: todayCount,
    per_wave: perWave, per_program: perProgram, per_jalur: perJalur,
    per_day: perDay, per_month: perMonth,
    per_kecamatan: perKecamatan, per_asal_sekolah: perAsalSekolah, per_desa: perDesa,
    uniform_sizes: uniformSizes,
    docs_incomplete: docsIncomplete, waiting_verify: waitingVerify, verified,
    payments: canSeePayments ? { count: payments?.c ?? 0, total: payments?.t ?? 0 } : null,
  });
});

export default router;
