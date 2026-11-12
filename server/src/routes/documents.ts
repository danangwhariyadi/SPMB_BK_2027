import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { db, dbNow } from '../db';
import { requireAuth, requirePerm, requireApplicantSession } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { validateUpload, savePrivateFile, deletePrivateFile, readPrivateFile, makeSignedUrl, verifySignedUrl } from '../services/storage';
import { randomToken } from '../util/helpers';

const router = Router();

export const DOC_TYPES: Record<string, string> = {
  kk: 'Fotokopi Kartu Keluarga (KK)',
  akta: 'Akta Kelahiran',
  transkrip: 'Surat Keterangan Nilai/Transkrip Nilai',
  ijazah: 'Ijazah',
  nisn: 'Kartu NISN',
  foto: 'Foto Hitam Putih 3x4 (6 lembar)',
  tka: 'Surat Keterangan Nilai TKA',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// ===== Upload dokumen oleh calon siswa (sesi pendaftaran) =====
router.post('/public/upload', requireApplicantSession, upload.single('file'), async (req: Request, res: Response) => {
  const applicantId = req.applicantSession!.applicantId;
  return handleUpload(req, res, applicantId, 'kamera/upload', false);
});

// ===== Upload / scan dokumen oleh panitia =====
router.post('/upload', requireAuth, requirePerm('dokumen', 'create'), upload.single('file'), async (req: Request, res: Response) => {
  const applicantId = parseInt(req.body.applicant_id, 10);
  if (!applicantId) return res.status(400).json({ error: 'applicant_id wajib diisi' });
  return handleUpload(req, res, applicantId, req.body.source || 'upload', true);
});

async function handleUpload(req: Request, res: Response, applicantId: number, source: string, isStaff: boolean) {
  const docType = String(req.body.doc_type || '');
  const declaredStatus = req.body.status === 'Belum Ada' ? 'Belum Ada' : 'Ada';
  if (!DOC_TYPES[docType]) return res.status(400).json({ error: 'Jenis dokumen tidak valid.' });
  if (source && !['scanner', 'upload', 'kamera'].includes(source)) return res.status(400).json({ error: 'Sumber dokumen tidak valid.' });

  const file = req.file;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  let mime: string | null = null;

  if (declaredStatus === 'Ada') {
    if (!file) return res.status(400).json({ error: 'File wajib diunggah bila status Ada.' });
    const v = validateUpload(file.mimetype, file.size);
    if (!v.ok) return res.status(400).json({ error: v.error });
    // Validasi ekstensi asli
    const ext = path.extname(file.originalname || '').toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) return res.status(400).json({ error: 'Ekstensi file harus JPG, JPEG, PNG, atau PDF.' });
    const saved = savePrivateFile(file.buffer, file.mimetype);
    filePath = saved.relativePath;
    fileName = path.basename(file.originalname || 'dokumen');
    fileSize = file.size;
    mime = file.mimetype;
  }

  const existing = await db.get('SELECT * FROM applicant_documents WHERE applicant_id=? AND doc_type=?', [applicantId, docType]);
  if (existing) {
    if (existing.file_path) deletePrivateFile(existing.file_path);
    await db.write(
      'UPDATE applicant_documents SET status=?, file_path=?, file_name=?, file_size=?, mime=?, source=?, note=?, uploaded_at=? WHERE id=?',
      [declaredStatus, filePath, fileName, fileSize, mime, source, req.body.note || null, declaredStatus === 'Ada' ? dbNow() : null, existing.id],
      'applicant_documents', String(existing.id)
    );
    await audit(req, isStaff ? 'upload_dokumen' : 'upload_dokumen_siswa', 'applicant_documents', existing.id, `${DOC_TYPES[docType]} (${declaredStatus}, ${source})`);
    return res.json({ ok: true, id: existing.id, status: declaredStatus });
  }
  const r = await db.write(
    'INSERT INTO applicant_documents (applicant_id, doc_type, status, file_path, file_name, file_size, mime, source, note, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [applicantId, docType, declaredStatus, filePath, fileName, fileSize, mime, source, req.body.note || null, declaredStatus === 'Ada' ? dbNow() : null],
    'applicant_documents'
  );
  await audit(req, isStaff ? 'upload_dokumen' : 'upload_dokumen_siswa', 'applicant_documents', r.lastID ?? null, `${DOC_TYPES[docType]} (${declaredStatus}, ${source})`);
  res.json({ ok: true, id: r.lastID, status: declaredStatus });
}

// ===== Daftar dokumen pendaftar =====
router.get('/applicant/:applicantId', requireAuth, requirePerm('dokumen', 'view'), async (req: Request, res: Response) => {
  const applicantId = parseInt(req.params.applicantId, 10);
  const docs = await db.all('SELECT id, doc_type, status, file_name, file_size, mime, source, note, uploaded_at FROM applicant_documents WHERE applicant_id=?', [applicantId]);
  res.json({
    types: DOC_TYPES,
    documents: docs.map(d => ({ ...d, url: d.file_path ? makeSignedUrl(d.id, applicantId) : null })),
    missing: Object.keys(DOC_TYPES).filter(t => t !== 'tka' && !docs.some(d => d.doc_type === t && d.status === 'Ada')),
  });
});

router.get('/mine', requireApplicantSession, async (req: Request, res: Response) => {
  const applicantId = req.applicantSession!.applicantId;
  const docs = await db.all('SELECT id, doc_type, status, file_name, file_size, mime, source, note, uploaded_at FROM applicant_documents WHERE applicant_id=?', [applicantId]);
  res.json({
    types: DOC_TYPES,
    documents: docs.map(d => ({ ...d, url: d.file_path ? makeSignedUrl(d.id, applicantId) : null })),
    missing: Object.keys(DOC_TYPES).filter(t => t !== 'tka' && !docs.some(d => d.doc_type === t && d.status === 'Ada')),
  });
});

// ===== Unduh dokumen via signed URL (privat) =====
router.get('/:id/file', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { applicantId, expires, signature } = req.query as any;
  if (!verifySignedUrl(id, parseInt(applicantId, 10), String(expires), String(signature || ''))) {
    return res.status(403).json({ error: 'Tautan tidak valid atau kedaluwarsa.' });
  }
  const doc = await db.get('SELECT * FROM applicant_documents WHERE id=? AND applicant_id=?', [id, parseInt(applicantId, 10)]);
  if (!doc || !doc.file_path) return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
  const buf = readPrivateFile(doc.file_path);
  if (!buf) return res.status(404).json({ error: 'File tidak ada di storage.' });
  res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${doc.file_name || 'dokumen'}"`);
  res.send(buf);
});

// ===== Hapus dokumen (panitia / pemilik) =====
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const doc = await db.get('SELECT * FROM applicant_documents WHERE id=?', [id]);
  if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
  if (req.applicantSession) {
    if (req.applicantSession.applicantId !== doc.applicant_id) {
      return res.status(403).json({ error: 'Tidak diizinkan.' });
    }
  } else if (!req.user) {
    return res.status(401).json({ error: 'Tidak terautentikasi.' });
  } else {
    const { getPerm } = await import('../middleware/rbac');
    if (!getPerm(req.user.role_code, 'dokumen').can_edit) {
      return res.status(403).json({ error: 'Tidak memiliki hak akses.' });
    }
  }
  if (doc.file_path) deletePrivateFile(doc.file_path);
  await db.write('UPDATE applicant_documents SET status=?, file_path=NULL, file_name=NULL, file_size=NULL, mime=NULL, uploaded_at=NULL WHERE id=?',
    ['Belum Ada', id], 'applicant_documents', String(id));
  await audit(req, 'hapus_dokumen', 'applicant_documents', id, `Hapus file ${doc.doc_type}`);
  res.json({ ok: true });
});

export default router;
