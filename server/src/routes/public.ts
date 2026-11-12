import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, dbNow } from '../db';
import { config } from '../config';
import { signApplicantSession, requireApplicantSession } from '../middleware/auth';
import { rateLimit, checkPublicAttempts, recordFailedAttempt, clearAttempts } from '../middleware/rateLimit';
import { audit } from '../middleware/audit';
import { nextRegistrationNumber, resolveActiveWave } from '../services/sequence';
import { issueOtp, verifyOtp, otpConfigured } from '../services/otp';
import { isValidIndonesianPhone, isValidNisn, ageAt10July2027, randomPin, randomToken } from '../util/helpers';
import { renderFormulirPdf } from '../services/pdf/formulirService';
import { makeSignedUrl } from '../services/storage';

const router = Router();

const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];
const JENJANG = ['SMP', 'MTs', 'Paket B', 'Lainnya'];
const UKURAN = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const PROGRAM = ['TEKNIK MESIN', 'TEKNIK OTOMOTIF', 'PPLG'];
const TINGKAT = ['Sekolah', 'Kecamatan', 'Kabupaten', 'Provinsi', 'Nasional', 'Internasional'];

// ===== Informasi publik =====
router.get('/info', async (_req: Request, res: Response) => {
  const settings = await db.all("SELECT skey, svalue FROM school_settings WHERE skey IN ('school_name','school_address','school_phone','school_email','school_website','ta','pendaftaran_dibuka','info_spmb')");
  const waves = await db.all('SELECT id, nama, start_date, end_date, quota_tm, quota_to, quota_pplg, is_active FROM registration_waves ORDER BY start_date');
  const counts = await db.all('SELECT program_keahlian, COUNT(*) AS total FROM applicants WHERE registration_number IS NOT NULL GROUP BY program_keahlian');
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.program_keahlian] = c.total;
  res.json({
    settings: Object.fromEntries(settings.map(s => [s.skey, s.svalue])),
    waves,
    quota_used: countMap,
    programs: [
      { kode: 'TEKNIK MESIN', nama: 'Teknik Mesin' },
      { kode: 'TEKNIK OTOMOTIF', nama: 'Teknik Otomotif' },
      { kode: 'PPLG', nama: 'Pengembangan Perangkat Lunak dan Gim (PPLG)' },
    ],
  });
});

router.get('/wave-status', async (_req: Request, res: Response) => {
  const wave = await resolveActiveWave();
  res.json({ open: Boolean(wave), wave });
});

// ===== Draft autosave (aman: token acak, tanpa data sensitif) =====
router.post('/draft', rateLimit({ windowMs: 60000, max: 60, key: 'draft' }), async (req: Request, res: Response) => {
  const { draft_token, step, data } = req.body || {};
  const token = typeof draft_token === 'string' && /^[a-f0-9]{48}$/.test(draft_token) ? draft_token : randomToken(24);
  const stepNum = Math.min(5, Math.max(1, parseInt(step, 10) || 1));
  const detail = JSON.stringify(data ?? {});
  const existing = await db.get('SELECT id FROM applicant_drafts WHERE draft_token=?', [token]);
  const meta = {
    nama_lengkap: String(data?.nama_lengkap ?? '').slice(0, 120),
    nisn: String(data?.nisn ?? '').slice(0, 10),
    hp_siswa: String(data?.hp_siswa ?? '').slice(0, 16),
  };
  if (existing) {
    await db.write(
      'UPDATE applicant_drafts SET step=?, nama_lengkap=?, nisn=?, hp_siswa=?, detail=?, updated_at=? WHERE draft_token=?',
      [stepNum, meta.nama_lengkap, meta.nisn, meta.hp_siswa, detail, dbNow(), token],
      'applicant_drafts', token
    );
  } else {
    await db.write(
      'INSERT INTO applicant_drafts (draft_token, step, nama_lengkap, nisn, hp_siswa, detail, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [token, stepNum, meta.nama_lengkap, meta.nisn, meta.hp_siswa, detail, dbNow(), dbNow()],
      'applicant_drafts', token
    );
  }
  res.json({ ok: true, draft_token: token, saved_at: dbNow() });
});

router.get('/draft/:token', rateLimit({ windowMs: 60000, max: 60, key: 'draft' }), async (req: Request, res: Response) => {
  const row = await db.get('SELECT * FROM applicant_drafts WHERE draft_token=?', [req.params.token]);
  if (!row) return res.status(404).json({ error: 'Draft tidak ditemukan' });
  res.json({ draft_token: row.draft_token, step: row.step, data: JSON.parse(row.detail || '{}'), updated_at: row.updated_at });
});

// ===== Validasi & kirim pendaftaran =====
function validatePayload(d: any): string[] {
  const errors: string[] = [];
  if (!d?.siswa?.nama_lengkap || String(d.siswa.nama_lengkap).trim().length < 3) errors.push('Nama lengkap wajib diisi (min. 3 karakter).');
  if (!isValidNisn(d?.siswa?.nisn)) errors.push('NISN harus 10 digit angka.');
  if (!d?.siswa?.tempat_lahir) errors.push('Tempat lahir wajib diisi.');
  if (!d?.siswa?.tanggal_lahir) errors.push('Tanggal lahir wajib diisi.');
  if (!['Laki-laki', 'Perempuan'].includes(d?.siswa?.jenis_kelamin)) errors.push('Jenis kelamin tidak valid.');
  if (!AGAMA.includes(d?.siswa?.agama)) errors.push('Agama tidak valid.');
  if (!d?.siswa?.alamat) errors.push('Alamat lengkap wajib diisi.');
  if (!d?.siswa?.desa || !d?.siswa?.kecamatan || !d?.siswa?.kabupaten) errors.push('Desa/Kecamatan/Kabupaten wajib diisi.');
  if (!isValidIndonesianPhone(d?.siswa?.hp_siswa)) errors.push('Nomor HP siswa tidak valid (format Indonesia).');
  if (!JENJANG.includes(d?.siswa?.jenjang_asal)) errors.push('Jenjang asal sekolah tidak valid.');
  if (!d?.siswa?.asal_sekolah) errors.push('Nama asal sekolah wajib diisi.');
  if (!UKURAN.includes(d?.siswa?.uniform_size)) errors.push('Ukuran seragam wajib dipilih.');
  if (!isValidIndonesianPhone(d?.ortu?.ayah_hp || d?.ortu?.ibu_hp || '')) errors.push('Minimal satu nomor HP orang tua valid.');
  if (d?.ortu?.ayah_hp && !isValidIndonesianPhone(d.ortu.ayah_hp)) errors.push('Nomor HP ayah tidak valid.');
  if (d?.ortu?.ibu_hp && !isValidIndonesianPhone(d.ortu.ibu_hp)) errors.push('Nomor HP ibu tidak valid.');
  if (d?.wali?.hp && !isValidIndonesianPhone(d.wali.hp)) errors.push('Nomor HP wali tidak valid.');
  if (!PROGRAM.includes(d?.pilihan?.program_keahlian)) errors.push('Program keahlian wajib dipilih.');
  if (!['Ya', 'Tidak'].includes(d?.prestasi?.memiliki)) errors.push('Status prestasi wajib diisi.');
  if (d?.prestasi?.memiliki === 'Ya' && !d?.prestasi?.nama) errors.push('Nama prestasi wajib diisi bila memiliki prestasi.');
  if (d?.pernyataan !== true) errors.push('Pernyataan kebenaran data wajib dicentang.');
  return errors;
}

router.post('/register', rateLimit({ windowMs: 60000, max: 10, key: 'register' }), async (req: Request, res: Response) => {
  const d = req.body?.data;
  const errors = validatePayload(d);
  if (errors.length) return res.status(400).json({ errors });

  const wave = await resolveActiveWave();
  if (!wave) return res.status(403).json({ error: 'Pendaftaran sedang tidak dibuka. Silakan pantau jadwal gelombang.' });

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
        [
          reg.number, pinHash, nowIso, wave.id, config.ta,
          d.prestasi?.memiliki === 'Ya' ? 'Prestasi' : 'Reguler',
          s.nama_lengkap, s.nisn, s.tempat_lahir, s.tanggal_lahir, s.jenis_kelamin, s.agama,
          s.alamat, s.desa, s.kecamatan, s.kabupaten, Number(s.jarak_km) || null,
          s.hp_siswa, Number(s.berat_badan) || null, Number(s.tinggi_badan) || null, umur,
          s.jenjang_asal, s.asal_sekolah, s.asal_kecamatan, s.asal_kabupaten, s.no_seri_ijazah || '',
          s.uniform_size, d.pilihan.program_keahlian,
          d.riwayat?.pernah === true ? 'Pernah' : 'Belum pernah',
          d.riwayat?.pernah ? s.riwayat_sekolah || '' : '',
          d.riwayat?.pernah ? s.riwayat_jurusan || '' : '',
          d.riwayat?.pernah ? s.riwayat_tahun || '' : '',
          d.riwayat?.pernah ? s.riwayat_status || '' : '',
          1, nowIso, nowIso, nowIso,
        ]
      );
      const applicantId = tx.lastID;
      const o = d.ortu || {};
      await tx.query(
        'INSERT INTO applicant_parents (applicant_id, ayah_nama, ayah_pekerjaan, ayah_hp, ibu_nama, ibu_pekerjaan, ibu_hp, alamat, rt, rw, desa, kecamatan, kabupaten) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [applicantId, o.ayah_nama || '', o.ayah_pekerjaan || '', o.ayah_hp || '', o.ibu_nama || '', o.ibu_pekerjaan || '', o.ibu_hp || '', o.alamat || '', o.rt || '', o.rw || '', o.desa || '', o.kecamatan || '', o.kabupaten || '']
      );
      const w = d.wali || {};
      await tx.query(
        'INSERT INTO applicant_guardians (applicant_id, nama, alamat, rt, rw, pekerjaan, hp, sama_dengan_ortu) VALUES (?,?,?,?,?,?,?,?)',
        [applicantId, w.nama || '', w.alamat || '', w.rt || '', w.rw || '', w.pekerjaan || '', w.hp || '', w.sama_dengan_ortu ? 1 : 0]
      );
      const p = d.prestasi || {};
      await tx.query(
        'INSERT INTO applicant_achievements (applicant_id, memiliki, nama, tingkat, tahun, keterangan) VALUES (?,?,?,?,?,?)',
        [applicantId, p.memiliki === 'Ya' ? 1 : 0, p.nama || '', p.tingkat || '', p.tahun || '', p.keterangan || '']
      );
      const tka = Array.isArray(d.tka) ? d.tka : [];
      for (const t of tka) {
        if (!t?.mapel) continue;
        await tx.query('INSERT INTO applicant_tka_scores (applicant_id, jenis, mapel, nilai) VALUES (?,?,?,?)',
          [applicantId, t.jenis === 'pilihan' ? 'pilihan' : 'wajib', String(t.mapel).slice(0, 120), Number(t.nilai) || null]);
      }
      await tx.query('INSERT INTO applicant_preferences (applicant_id, pilihan, program_keahlian) VALUES (?,?,?)',
        [applicantId, 1, d.pilihan.program_keahlian]);
      await tx.query(
        'INSERT INTO registration_status_history (applicant_id, status_from, status_to, changed_by, note, created_at) VALUES (?,?,?,?,?,?)',
        [applicantId, '', 'Pendaftaran Baru', 'sistem', `Pendaftaran online gelombang ${wave.nama}`, nowIso]
      );
      return { applicantId, regNumber: reg.number };
    });

    // Fan-out sinkronisasi ke database sekunder (non-transaksional)
    const app = await db.get('SELECT * FROM applicants WHERE registration_number=?', [result.regNumber]);
    if (app) {
      const tables = [
        ['applicant_parents', 'applicant_id'], ['applicant_guardians', 'applicant_id'],
        ['applicant_achievements', 'applicant_id'], ['applicant_tka_scores', 'applicant_id'],
        ['applicant_preferences', 'applicant_id'],
      ];
      for (const [tbl, col] of tables) {
        const rows = await db.all(`SELECT * FROM ${tbl} WHERE ${col}=?`, [result.applicantId]);
        for (const r of rows) {
          const keys = Object.keys(r).filter(k => k !== 'id');
          await db.write(
            `INSERT INTO ${tbl} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
            keys.map(k => r[k]), tbl
          ).catch(() => undefined);
        }
      }
      const hist = await db.all('SELECT * FROM registration_status_history WHERE applicant_id=?', [result.applicantId]);
      for (const r of hist) {
        const keys = Object.keys(r).filter(k => k !== 'id');
        await db.write(`INSERT INTO registration_status_history (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          keys.map(k => r[k]), 'registration_status_history').catch(() => undefined);
      }
    }

    // Bersihkan draft
    if (req.body?.draft_token) {
      await db.write('DELETE FROM applicant_drafts WHERE draft_token=?', [req.body.draft_token], 'applicant_drafts').catch(() => undefined);
    }

    const { sendWhatsApp, templates } = await import('../services/notify');
    const wa = await sendWhatsApp(s.hp_siswa, templates.pendaftaranBerhasil(s.nama_lengkap, result.regNumber, pin, wave.nama));

    await audit(req, 'pendaftaran_online', 'applicants', result.applicantId, `Pendaftaran online ${s.nama_lengkap}`);

    res.json({
      ok: true,
      registration_number: result.regNumber,
      pin,
      gelombang: wave.nama,
      tanggal: dbNow(),
      wa_sent: wa.sent,
    });
  } catch (e: any) {
    console.error('[register]', e);
    res.status(500).json({ error: 'Gagal menyimpan pendaftaran. Coba lagi.' });
  }
});

// ===== Cek / ubah pendaftaran =====
router.post('/check/start', rateLimit({ windowMs: 60000, max: 15, key: 'check' }), async (req: Request, res: Response) => {
  const { registration_number, pin } = req.body || {};
  const key = `check:${req.ip}:${String(registration_number || '')}`;
  const gate = await checkPublicAttempts(key, config.publicMaxLoginAttempts, config.publicLockMinutes);
  if (!gate.allowed) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });

  const app = await db.get('SELECT * FROM applicants WHERE registration_number=?', [String(registration_number || '').trim().toUpperCase()]);
  if (!app || !app.pin_hash) {
    await recordFailedAttempt(key, config.publicMaxLoginAttempts, config.publicLockMinutes);
    return res.status(401).json({ error: 'Nomor pendaftaran tidak ditemukan.', remaining: Math.max(0, gate.remaining - 1) });
  }
  const pinOk = await bcrypt.compare(String(pin || ''), app.pin_hash);
  if (!pinOk) {
    await recordFailedAttempt(key, config.publicMaxLoginAttempts, config.publicLockMinutes);
    return res.status(401).json({ error: 'PIN salah.', remaining: Math.max(0, gate.remaining - 1) });
  }
  await clearAttempts(key);

  let otpRequired = otpConfigured();
  let devOtp: string | undefined;
  if (otpRequired) {
    const r = await issueOtp(app.hp_siswa, app.id, 'cek-pendaftaran');
    devOtp = r.devOtp;
  }
  if (!otpConfigured()) {
    // Tanpa provider OTP: PIN rahasia adalah autentikasi utama.
    otpRequired = false;
  }
  const token = signApplicantSession(app.id, app.registration_number);
  res.json({ ok: true, otp_required: otpRequired, otp_target: otpRequired ? app.hp_siswa : undefined, dev_otp: devOtp, session_token: token });
});

router.post('/check/verify-otp', rateLimit({ windowMs: 60000, max: 15, key: 'check' }), async (req: Request, res: Response) => {
  const { registration_number, code } = req.body || {};
  const app = await db.get('SELECT * FROM applicants WHERE registration_number=?', [String(registration_number || '').trim().toUpperCase()]);
  if (!app) return res.status(401).json({ error: 'Nomor pendaftaran tidak ditemukan.' });
  const r = await verifyOtp(app.hp_siswa, String(code || ''), 'cek-pendaftaran');
  if (!r.ok) return res.status(401).json({ error: r.error });
  const token = signApplicantSession(app.id, app.registration_number);
  res.json({ ok: true, session_token: token });
});

function maskApplicant(a: any) {
  const { pin_hash, ...rest } = a;
  return rest;
}

router.get('/application', requireApplicantSession, async (req: Request, res: Response) => {
  const id = req.applicantSession!.applicantId;
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const parents = await db.get('SELECT * FROM applicant_parents WHERE applicant_id=?', [id]);
  const guardian = await db.get('SELECT * FROM applicant_guardians WHERE applicant_id=?', [id]);
  const ach = await db.get('SELECT * FROM applicant_achievements WHERE applicant_id=?', [id]);
  const tka = await db.all('SELECT * FROM applicant_tka_scores WHERE applicant_id=?', [id]);
  const prefs = await db.all('SELECT * FROM applicant_preferences WHERE applicant_id=?', [id]);
  const docs = await db.all('SELECT id, doc_type, status, file_name, file_size, mime, source, note, uploaded_at FROM applicant_documents WHERE applicant_id=?', [id]);
  const wave = a.wave_id ? await db.get('SELECT nama FROM registration_waves WHERE id=?', [a.wave_id]) : null;
  const health = await db.get('SELECT * FROM health_examinations WHERE applicant_id=? ORDER BY id DESC', [id]);
  const interview = await db.get('SELECT * FROM interviews WHERE applicant_id=? ORDER BY id DESC', [id]);
  const history = await db.all('SELECT * FROM registration_status_history WHERE applicant_id=? ORDER BY id ASC', [id]);
  const missing = ['kk', 'akta', 'transkrip', 'ijazah', 'nisn', 'foto'].filter(t => !docs.some(d => d.doc_type === t && d.status === 'Ada'));
  res.json({
    applicant: maskApplicant(a),
    parents, guardian, achievements: ach, tka, preferences: prefs,
    documents: docs.map(d => ({ ...d, url: d.file_path ? makeSignedUrl(d.id, id) : null })),
    wave: wave?.nama || '',
    health, interview, history, missing_documents: missing,
    editable: !a.is_locked && a.status_verifikasi !== 'Disetujui',
  });
});

router.put('/application', requireApplicantSession, rateLimit({ windowMs: 60000, max: 30, key: 'app-update' }), async (req: Request, res: Response) => {
  const id = req.applicantSession!.applicantId;
  const a = await db.get('SELECT * FROM applicants WHERE id=?', [id]);
  if (!a) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (a.is_locked || a.status_verifikasi === 'Disetujui') {
    return res.status(403).json({ error: 'Pendaftaran sudah diverifikasi/dikunci. Perubahan memerlukan persetujuan panitia.' });
  }
  const d = req.body?.data;
  if (!d?.siswa) return res.status(400).json({ error: 'Data tidak valid' });
  const s = d.siswa;
  const umur = ageAt10July2027(s.tanggal_lahir || a.tanggal_lahir);
  await db.write(
    `UPDATE applicants SET nama_lengkap=?, nisn=?, tempat_lahir=?, tanggal_lahir=?, jenis_kelamin=?, agama=?, alamat=?, desa=?, kecamatan=?, kabupaten=?, jarak_km=?, hp_siswa=?, berat_badan=?, tinggi_badan=?, umur_10juli=?, jenjang_asal=?, asal_sekolah=?, asal_kecamatan=?, asal_kabupaten=?, no_seri_ijazah=?, uniform_size=?, program_keahlian=?, updated_at=? WHERE id=?`,
    [s.nama_lengkap ?? a.nama_lengkap, s.nisn ?? a.nisn, s.tempat_lahir ?? a.tempat_lahir, s.tanggal_lahir ?? a.tanggal_lahir,
      s.jenis_kelamin ?? a.jenis_kelamin, s.agama ?? a.agama, s.alamat ?? a.alamat, s.desa ?? a.desa, s.kecamatan ?? a.kecamatan,
      s.kabupaten ?? a.kabupaten, Number(s.jarak_km) || null, s.hp_siswa ?? a.hp_siswa, Number(s.berat_badan) || null,
      Number(s.tinggi_badan) || null, umur, s.jenjang_asal ?? a.jenjang_asal, s.asal_sekolah ?? a.asal_sekolah,
      s.asal_kecamatan ?? a.asal_kecamatan, s.asal_kabupaten ?? a.asal_kabupaten, s.no_seri_ijazah ?? a.no_seri_ijazah,
      s.uniform_size ?? a.uniform_size, s.program_keahlian ?? a.program_keahlian, dbNow(), id],
    'applicants', String(id)
  );
  const o = d.ortu || {};
  const parents = await db.get('SELECT id FROM applicant_parents WHERE applicant_id=?', [id]);
  if (parents) {
    await db.write(
      'UPDATE applicant_parents SET ayah_nama=?, ayah_pekerjaan=?, ayah_hp=?, ibu_nama=?, ibu_pekerjaan=?, ibu_hp=?, alamat=?, rt=?, rw=?, desa=?, kecamatan=?, kabupaten=? WHERE applicant_id=?',
      [o.ayah_nama || '', o.ayah_pekerjaan || '', o.ayah_hp || '', o.ibu_nama || '', o.ibu_pekerjaan || '', o.ibu_hp || '', o.alamat || '', o.rt || '', o.rw || '', o.desa || '', o.kecamatan || '', o.kabupaten || '', id],
      'applicant_parents'
    );
  }
  const w = d.wali || {};
  const guardian = await db.get('SELECT id FROM applicant_guardians WHERE applicant_id=?', [id]);
  if (guardian) {
    await db.write(
      'UPDATE applicant_guardians SET nama=?, alamat=?, rt=?, rw=?, pekerjaan=?, hp=?, sama_dengan_ortu=? WHERE applicant_id=?',
      [w.nama || '', w.alamat || '', w.rt || '', w.rw || '', w.pekerjaan || '', w.hp || '', w.sama_dengan_ortu ? 1 : 0, id],
      'applicant_guardians'
    );
  }
  await db.write(
    'INSERT INTO registration_status_history (applicant_id, status_from, status_to, changed_by, note, created_at) VALUES (?,?,?,?,?,?)',
    [id, a.status_admin, a.status_admin, 'calon-siswa', 'Perubahan data oleh calon siswa', dbNow()],
    'registration_status_history'
  );
  await audit(req, 'ubah_data_calon_siswa', 'applicants', id, 'Calon siswa memperbarui data pendaftaran');
  res.json({ ok: true });
});

router.get('/application/pdf', requireApplicantSession, async (req: Request, res: Response) => {
  const id = req.applicantSession!.applicantId;
  const pdf = await renderFormulirPdf(id);
  if (!pdf) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const a = await db.get('SELECT registration_number FROM applicants WHERE id=?', [id]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Formulir-${a?.registration_number}.pdf"`);
  res.send(Buffer.from(pdf));
});

export default router;
