import { Router, Request, Response } from 'express';
import { db, dbNow } from '../db';
import { requireAuth, requirePerm } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { sendWhatsApp, templates } from '../services/notify';

const router = Router();
router.use(requireAuth);

// ===== KESEHATAN =====
const healthFields = ['berat_badan', 'tinggi_badan', 'lingkar_kepala', 'buta_warna', 'penglihatan', 'penyakit_bawaan', 'catatan', 'status'];

router.get('/health', requirePerm('kesehatan', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all(
    `SELECT h.*, a.nama_lengkap, a.registration_number, a.program_keahlian, w.nama AS wave_nama
     FROM health_examinations h
     JOIN applicants a ON a.id=h.applicant_id
     LEFT JOIN registration_waves w ON w.id=a.wave_id
     ORDER BY h.id DESC`
  );
  res.json({ rows });
});

router.post('/health', requirePerm('kesehatan', 'create'), async (req: Request, res: Response) => {
  const { applicant_id } = req.body || {};
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [parseInt(applicant_id, 10)]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const existing = await db.get('SELECT id FROM health_examinations WHERE applicant_id=?', [a.id]);
  const vals = {
    berat_badan: Number(req.body.berat_badan) || null,
    tinggi_badan: Number(req.body.tinggi_badan) || null,
    lingkar_kepala: Number(req.body.lingkar_kepala) || null,
    buta_warna: req.body.buta_warna || '',
    penglihatan: req.body.penglihatan || 'Normal',
    penyakit_bawaan: req.body.penyakit_bawaan || '',
    catatan: req.body.catatan || '',
    status: ['Belum diproses', 'Sedang diproses', 'Perlu perbaikan', 'Lengkap', 'Disetujui', 'Ditolak'].includes(req.body.status) ? req.body.status : 'Sedang diproses',
  };
  if (existing) {
    await db.write(
      `UPDATE health_examinations SET berat_badan=?, tinggi_badan=?, lingkar_kepala=?, buta_warna=?, penglihatan=?, penyakit_bawaan=?, catatan=?, status=?, examiner_id=?, examiner_name=?, examined_at=?, updated_at=? WHERE id=?`,
      [vals.berat_badan, vals.tinggi_badan, vals.lingkar_kepala, vals.buta_warna, vals.penglihatan, vals.penyakit_bawaan, vals.catatan, vals.status, req.user!.id, req.user!.full_name, dbNow(), dbNow(), existing.id],
      'health_examinations', String(existing.id)
    );
    await audit(req, 'edit_kesehatan', 'health_examinations', existing.id, `Update kesehatan ${a.registration_number}`);
    return res.json({ ok: true, id: existing.id });
  }
  const r = await db.write(
    `INSERT INTO health_examinations (applicant_id, berat_badan, tinggi_badan, lingkar_kepala, buta_warna, penglihatan, penyakit_bawaan, catatan, status, examiner_id, examiner_name, examined_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [a.id, vals.berat_badan, vals.tinggi_badan, vals.lingkar_kepala, vals.buta_warna, vals.penglihatan, vals.penyakit_bawaan, vals.catatan, vals.status, req.user!.id, req.user!.full_name, dbNow(), dbNow(), dbNow()],
    'health_examinations'
  );
  await db.write('UPDATE applicants SET status_kesehatan=?, updated_at=? WHERE id=?', [vals.status, dbNow(), a.id], 'applicants', String(a.id));
  await audit(req, 'input_kesehatan', 'health_examinations', r.lastID ?? null, `Input kesehatan ${a.registration_number}`);
  res.json({ ok: true, id: r.lastID });
});

router.get('/health/:applicantId/detail', requirePerm('kesehatan', 'view'), async (req: Request, res: Response) => {
  const h = await db.get('SELECT * FROM health_examinations WHERE applicant_id=? ORDER BY id DESC', [parseInt(req.params.applicantId, 10)]);
  res.json({ examination: h });
});

// ===== WAWANCARA =====
router.get('/interview/questions', requirePerm('wawancara', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT * FROM interview_questions WHERE is_active=1 ORDER BY sort_order ASC, id ASC');
  res.json({ rows });
});

router.post('/interview/questions', requirePerm('wawancara', 'create'), async (req: Request, res: Response) => {
  const { label, type = 'text', options = '', sort_order = 0 } = req.body || {};
  if (!label) return res.status(400).json({ error: 'Pertanyaan wajib diisi' });
  const r = await db.write(
    'INSERT INTO interview_questions (label, type, options, sort_order) VALUES (?,?,?,?)',
    [String(label).slice(0, 300), ['text', 'textarea', 'select', 'number'].includes(type) ? type : 'text', String(options).slice(0, 500), Number(sort_order) || 0],
    'interview_questions'
  );
  await audit(req, 'tambah_pertanyaan_wawancara', 'interview_questions', r.lastID ?? null, label);
  res.json({ ok: true, id: r.lastID });
});

router.delete('/interview/questions/:id', requirePerm('wawancara', 'delete'), async (req: Request, res: Response) => {
  await db.write('UPDATE interview_questions SET is_active=0 WHERE id=?', [parseInt(req.params.id, 10)], 'interview_questions', req.params.id);
  await audit(req, 'hapus_pertanyaan_wawancara', 'interview_questions', req.params.id, '');
  res.json({ ok: true });
});

router.get('/interview', requirePerm('wawancara', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all(
    `SELECT i.*, a.nama_lengkap, a.registration_number, a.program_keahlian, w.nama AS wave_nama
     FROM interviews i JOIN applicants a ON a.id=i.applicant_id
     LEFT JOIN registration_waves w ON w.id=a.wave_id ORDER BY i.id DESC`
  );
  const answers = await db.all('SELECT * FROM interview_answers');
  res.json({
    rows: rows.map(r => ({ ...r, answers: answers.filter(x => x.interview_id === r.id) })),
  });
});

router.post('/interview', requirePerm('wawancara', 'create'), async (req: Request, res: Response) => {
  const { applicant_id, answers = [], catatan = '', rekomendasi = '', status = 'Sedang diproses', scheduled_at = null } = req.body || {};
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [parseInt(applicant_id, 10)]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const questions = await db.all('SELECT * FROM interview_questions WHERE is_active=1');
  const existing = await db.get('SELECT id FROM interviews WHERE applicant_id=?', [a.id]);
  let interviewId: number;
  if (existing) {
    await db.write(
      'UPDATE interviews SET catatan=?, rekomendasi=?, status=?, scheduled_at=?, interviewer_id=?, interviewer_name=?, updated_at=? WHERE id=?',
      [catatan, rekomendasi, status, scheduled_at, req.user!.id, req.user!.full_name, dbNow(), existing.id],
      'interviews', String(existing.id)
    );
    interviewId = existing.id;
    await db.write('DELETE FROM interview_answers WHERE interview_id=?', [interviewId], 'interview_answers');
  } else {
    const r = await db.write(
      'INSERT INTO interviews (applicant_id, interviewer_id, interviewer_name, catatan, rekomendasi, status, scheduled_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [a.id, req.user!.id, req.user!.full_name, catatan, rekomendasi, status, scheduled_at, dbNow(), dbNow()],
      'interviews'
    );
    interviewId = r.lastID!;
  }
  for (const q of questions) {
    const ans = answers.find((x: any) => x.question_id === q.id);
    await db.write('INSERT INTO interview_answers (interview_id, question_id, question_label, answer) VALUES (?,?,?,?)',
      [interviewId, q.id, q.label, ans ? String(ans.answer ?? '').slice(0, 1000) : ''], 'interview_answers');
  }
  await db.write('UPDATE applicants SET status_wawancara=?, updated_at=? WHERE id=?', [status, dbNow(), a.id], 'applicants', String(a.id));
  await audit(req, 'input_wawancara', 'interviews', interviewId, `Wawancara ${a.registration_number} (${status})`);
  res.json({ ok: true, id: interviewId });
});

router.post('/interview/notify-schedule', requirePerm('wawancara', 'create'), async (req: Request, res: Response) => {
  const { applicant_id, scheduled_at } = req.body || {};
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [parseInt(applicant_id, 10)]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const r = await sendWhatsApp(a.hp_siswa, templates.jadwalWawancara(a.nama_lengkap, String(scheduled_at || '')));
  await audit(req, 'kirim_jadwal_wawancara', 'applicants', a.id, `WA: ${r.sent ? 'terkirim' : 'gagal'}`);
  res.json({ ok: true, sent: r.sent, error: r.error });
});

// ===== VERIFIKASI =====
router.get('/verify', requirePerm('verifikasi', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all(
    `SELECT a.id, a.registration_number, a.nama_lengkap, a.program_keahlian, a.status_berkas, a.status_verifikasi, a.is_locked, w.nama AS wave_nama,
       (SELECT COUNT(*) FROM applicant_documents d WHERE d.applicant_id=a.id AND d.status='Ada') AS docs_ada
     FROM applicants a LEFT JOIN registration_waves w ON w.id=a.wave_id
     WHERE a.registration_number IS NOT NULL ORDER BY a.registration_number ASC`
  );
  res.json({ rows });
});

router.get('/verify/:applicantId', requirePerm('verifikasi', 'view'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.applicantId, 10);
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const docs = await db.all('SELECT * FROM applicant_documents WHERE applicant_id=?', [id]);
  const verifs = await db.all('SELECT * FROM document_verifications WHERE applicant_id=? ORDER BY id DESC', [id]);
  res.json({
    applicant: { ...a, pin_hash: undefined },
    documents: docs.map(d => ({ ...d, url: d.file_path ? require('../services/storage').makeSignedUrl(d.id, id) : null })),
    verifications: verifs,
  });
});

router.post('/verify/:applicantId/document', requirePerm('verifikasi', 'create'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.applicantId, 10);
  const { doc_type, status, note = '' } = req.body || {};
  if (!['valid', 'tidak_valid'].includes(status)) return res.status(400).json({ error: 'Status tidak valid' });
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const r = await db.write(
    'INSERT INTO document_verifications (applicant_id, doc_type, status, note, verifier_id, verifier_name, verified_at) VALUES (?,?,?,?,?,?,?)',
    [id, doc_type || null, status, note, req.user!.id, req.user!.full_name, dbNow()],
    'document_verifications'
  );
  await audit(req, 'verifikasi_dokumen', 'document_verifications', r.lastID ?? null, `${a.registration_number} ${doc_type}: ${status} ${note}`);
  res.json({ ok: true, id: r.lastID });
});

router.post('/verify/:applicantId/complete', requirePerm('verifikasi', 'create'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.applicantId, 10);
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const { action, note = '' } = req.body || {};
  let newStatus: string;
  if (action === 'lengkap') newStatus = 'Lengkap';
  else if (action === 'perbaikan') newStatus = 'Perlu perbaikan';
  else if (action === 'setujui') newStatus = 'Disetujui';
  else if (action === 'tolak') newStatus = 'Ditolak';
  else return res.status(400).json({ error: 'Aksi tidak dikenal' });
  await db.write('UPDATE applicants SET status_verifikasi=?, status_berkas=?, is_locked=?, updated_at=? WHERE id=?',
    [newStatus, newStatus, action === 'setujui' || action === 'tolak' ? 1 : 0, dbNow(), id], 'applicants', String(id));
  await db.write('INSERT INTO registration_status_history (applicant_id, status_from, status_to, changed_by, note, created_at) VALUES (?,?,?,?,?,?)',
    [id, a.status_verifikasi, newStatus, req.user!.username, note, dbNow()], 'registration_status_history');
  const { sendWhatsApp } = await import('../services/notify');
  if (action === 'perbaikan') await sendWhatsApp(a.hp_siswa, templates.dokumenPerluPerbaikan(a.nama_lengkap, note));
  if (action === 'lengkap') await sendWhatsApp(a.hp_siswa, templates.dokumenLengkap(a.nama_lengkap));
  await audit(req, 'verifikasi_status', 'applicants', id, `${a.registration_number}: ${newStatus}. ${note}`);
  res.json({ ok: true, status: newStatus });
});

export default router;
