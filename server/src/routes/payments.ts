import { Router, Request, Response } from 'express';
import { db, dbNow } from '../db';
import { requireAuth, requirePerm } from '../middleware/auth';
import { audit } from '../middleware/audit';
import { config } from '../config';
import { exportExcel } from '../services/export/excel';

const router = Router();
router.use(requireAuth);

const money = (n: number) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

router.get('/fee-types', requirePerm('pembayaran', 'view'), async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT * FROM fee_types WHERE is_active=1 ORDER BY id ASC');
  res.json({ rows });
});

router.post('/fee-types', requirePerm('pengaturan', 'edit'), async (req: Request, res: Response) => {
  const { nama, nominal } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'Nama jenis biaya wajib diisi' });
  const r = await db.write('INSERT INTO fee_types (nama, nominal) VALUES (?,?)', [String(nama).slice(0, 120), Number(nominal) || 0], 'fee_types');
  await audit(req, 'tambah_jenis_biaya', 'fee_types', r.lastID ?? null, `${nama} = ${nominal}`);
  res.json({ ok: true, id: r.lastID });
});

router.delete('/fee-types/:id', requirePerm('pengaturan', 'edit'), async (req: Request, res: Response) => {
  await db.write('UPDATE fee_types SET is_active=0 WHERE id=?', [parseInt(req.params.id, 10)], 'fee_types', req.params.id);
  await audit(req, 'hapus_jenis_biaya', 'fee_types', req.params.id, '');
  res.json({ ok: true });
});

// ===== Daftar pembayaran =====
router.get('/', requirePerm('pembayaran', 'view'), async (req: Request, res: Response) => {
  const { wave = '', program = '', date = '', q = '' } = req.query as any;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (wave) { where.push('p.wave_id=?'); params.push(wave); }
  if (program) { where.push('p.program_keahlian=?'); params.push(program); }
  if (date) { where.push('substr(p.tanggal,1,10)=?'); params.push(date); }
  if (q) { where.push('(p.nama_lengkap LIKE ? OR p.registration_number LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const rows = await db.all(
    `SELECT p.*, w.nama AS wave_nama FROM payments p LEFT JOIN registration_waves w ON w.id=p.wave_id WHERE ${where.join(' AND ')} ORDER BY p.id DESC`,
    params
  );
  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  res.json({ rows, total, total_label: money(total) });
});

router.get('/:id', requirePerm('pembayaran', 'view'), async (req: Request, res: Response) => {
  const p = await db.get('SELECT * FROM payments WHERE id=?', [parseInt(req.params.id, 10)]);
  if (!p) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });
  const items = await db.all('SELECT * FROM payment_items WHERE payment_id=?', [p.id]);
  // Audit log perubahan pembayaran (Admin & Ketua)
  const canSeeAudit = ['admin', 'ketua'].includes(req.user!.role_code);
  const logs = canSeeAudit
    ? await db.all("SELECT * FROM audit_logs WHERE entity='payments' AND entity_id=? ORDER BY id DESC", [String(p.id)])
    : undefined;
  res.json({ payment: p, items, audit_logs: logs });
});

// ===== Input pembayaran (Bendahara) =====
router.post('/', requirePerm('pembayaran', 'create'), async (req: Request, res: Response) => {
  const { applicant_id, items = [], metode = 'Tunai', keterangan = '' } = req.body || {};
  const a = await db.get('SELECT * FROM applicants WHERE id=? AND registration_number IS NOT NULL', [parseInt(applicant_id, 10)]);
  if (!a) return res.status(404).json({ error: 'Pendaftar tidak ditemukan' });
  const cleanItems = (Array.isArray(items) ? items : [])
    .filter((i: any) => i && i.nama)
    .map((i: any) => ({ fee_type_id: i.fee_type_id || null, nama: String(i.nama).slice(0, 120), nominal: Number(i.nominal) || 0 }));
  if (!cleanItems.length) return res.status(400).json({ error: 'Minimal satu jenis biaya dipilih.' });
  const total = cleanItems.reduce((s: number, i: any) => s + i.nominal, 0);
  const seq = await db.get('SELECT COUNT(*) AS c FROM payments');
  const receiptNo = `BP-${String((seq?.c ?? 0) + 1).padStart(5, '0')}`;
  const r = await db.write(
    `INSERT INTO payments (applicant_id, registration_number, nama_lengkap, wave_id, program_keahlian, tanggal, total, metode, keterangan, status, receiver_name, created_by, updated_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [a.id, a.registration_number, a.nama_lengkap, a.wave_id, a.program_keahlian, dbNow(), total, metode, keterangan, 'Lunas', req.user!.full_name, req.user!.username, req.user!.username, dbNow(), dbNow()],
    'payments'
  );
  const paymentId = r.lastID!;
  for (const it of cleanItems) {
    await db.write('INSERT INTO payment_items (payment_id, fee_type_id, nama, nominal) VALUES (?,?,?,?)',
      [paymentId, it.fee_type_id, it.nama, it.nominal], 'payment_items');
  }
  await audit(req, 'input_pembayaran', 'payments', paymentId, `${a.registration_number} total ${money(total)} oleh ${req.user!.username}`);
  res.json({ ok: true, id: paymentId, receipt_no: receiptNo, total });
});

// ===== Edit pembayaran (Bendahara) =====
router.put('/:id', requirePerm('pembayaran', 'edit'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const p = await db.get('SELECT * FROM payments WHERE id=?', [id]);
  if (!p) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });
  const { items = [], metode = p.metode, keterangan = p.keterangan, status = p.status } = req.body || {};
  const cleanItems = (Array.isArray(items) ? items : [])
    .filter((i: any) => i && i.nama)
    .map((i: any) => ({ fee_type_id: i.fee_type_id || null, nama: String(i.nama).slice(0, 120), nominal: Number(i.nominal) || 0 }));
  if (!cleanItems.length) return res.status(400).json({ error: 'Minimal satu jenis biaya.' });
  const total = cleanItems.reduce((s: number, i: any) => s + i.nominal, 0);
  await db.write(
    'UPDATE payments SET total=?, metode=?, keterangan=?, status=?, updated_by=?, updated_at=? WHERE id=?',
    [total, metode, keterangan, status, req.user!.username, dbNow(), id], 'payments', String(id)
  );
  await db.write('DELETE FROM payment_items WHERE payment_id=?', [id], 'payment_items');
  for (const it of cleanItems) {
    await db.write('INSERT INTO payment_items (payment_id, fee_type_id, nama, nominal) VALUES (?,?,?,?)',
      [id, it.fee_type_id, it.nama, it.nominal], 'payment_items');
  }
  await audit(req, 'edit_pembayaran', 'payments', id, `Edit pembayaran ${p.registration_number}: total lama ${money(p.total)} -> baru ${money(total)}; penerima sebelumnya ${p.receiver_name}`);
  res.json({ ok: true });
});

// ===== Cetak bukti pembayaran =====
router.get('/:id/receipt.pdf', requirePerm('pembayaran', 'view'), async (req: Request, res: Response) => {
  const p = await db.get('SELECT * FROM payments WHERE id=?', [parseInt(req.params.id, 10)]);
  if (!p) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });
  const items = await db.all('SELECT * FROM payment_items WHERE payment_id=?', [p.id]);
  const wave = p.wave_id ? await db.get('SELECT nama FROM registration_waves WHERE id=?', [p.wave_id]) : null;
  const schoolName = (await db.get("SELECT svalue FROM school_settings WHERE skey='school_name'"))?.svalue || 'SMK BHINA KARYA KARANGANYAR';
  const schoolAddress = (await db.get("SELECT svalue FROM school_settings WHERE skey='school_address'"))?.svalue || '';
  const { generateReceipt } = await import('../services/pdf/receipt');
  const fs = await import('fs');
  let logo: Buffer | null = null;
  const logoPath = path2(config);
  if (fs.existsSync(logoPath)) logo = fs.readFileSync(logoPath);
  const pdf = await generateReceipt({
    receipt_no: `BP-${String(p.id).padStart(5, '0')}`,
    tanggal: String(p.tanggal).slice(0, 10),
    nama: p.nama_lengkap,
    registration_number: p.registration_number,
    program_keahlian: p.program_keahlian,
    gelombang: wave?.nama || '',
    items: items.map(i => ({ nama: i.nama, nominal: Number(i.nominal) })),
    total: Number(p.total),
    metode: p.metode,
    receiver: p.receiver_name || '',
    school_name: schoolName,
    school_address: schoolAddress,
  }, logo);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Bukti-Bayar-${p.id}.pdf"`);
  res.send(Buffer.from(pdf));
});

function path2(cfg: any): string {
  return require('path').resolve(__dirname, '../../assets/logobk.png');
}

// ===== Laporan keuangan =====
router.get('/report/finance', requirePerm('pembayaran', 'view'), async (req: Request, res: Response) => {
  const { wave = '', program = '', date = '' } = req.query as any;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (wave) { where.push('p.wave_id=?'); params.push(wave); }
  if (program) { where.push('p.program_keahlian=?'); params.push(program); }
  if (date) { where.push('substr(p.tanggal,1,10)=?'); params.push(date); }
  const rows = await db.all(
    `SELECT p.*, w.nama AS wave_nama FROM payments p LEFT JOIN registration_waves w ON w.id=p.wave_id WHERE ${where.join(' AND ')} ORDER BY p.tanggal ASC`,
    params
  );
  const perType = await db.all(
    `SELECT pi.nama, COUNT(*) AS jumlah, SUM(pi.nominal) AS total FROM payment_items pi
     JOIN payments p ON p.id=pi.payment_id WHERE ${where.join(' AND ')} GROUP BY pi.nama ORDER BY pi.nama`,
    params
  );
  const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  res.json({ rows, per_type: perType, total, total_label: money(total) });
});

// Export Excel laporan keuangan sesuai filter
router.get('/report/finance/excel', requirePerm('pembayaran', 'view'), async (req: Request, res: Response) => {
  const { wave = '', program = '', date = '' } = req.query as any;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (wave) { where.push('p.wave_id=?'); params.push(wave); }
  if (program) { where.push('p.program_keahlian=?'); params.push(program); }
  if (date) { where.push('substr(p.tanggal,1,10)=?'); params.push(date); }
  const rows = await db.all(
    `SELECT p.*, w.nama AS wave_nama FROM payments p LEFT JOIN registration_waves w ON w.id=p.wave_id WHERE ${where.join(' AND ')} ORDER BY p.tanggal ASC`,
    params
  );
  const header = ['No. Bukti', 'Tanggal', 'No. Pendaftaran', 'Nama', 'Program Keahlian', 'Gelombang', 'Metode', 'Total', 'Status', 'Penerima'];
  const data = rows.map(r => [
    `BP-${String(r.id).padStart(5, '0')}`, String(r.tanggal).slice(0, 10), r.registration_number, r.nama_lengkap,
    r.program_keahlian, r.wave_nama || '-', r.metode, Number(r.total), r.status, r.receiver_name || '-',
  ]);
  const buf = await exportExcel('Laporan Pembiayaan SPMB', header, data);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="laporan-keuangan.xlsx"');
  res.send(buf);
});

export default router;
