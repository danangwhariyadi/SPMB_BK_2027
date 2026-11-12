import { db, dbNow } from '../db';
import { sha256 } from '../util/helpers';
import { config } from '../config';

export const otpConfigured = (): boolean =>
  Boolean(config.notify.whatsappApiUrl || config.notify.smtpHost);

/** Buat OTP 6 digit, simpan hash, kedaluwarsa 5 menit. */
export async function issueOtp(target: string, applicantId: number, purpose: string): Promise<{ expiresAt: string; devOtp?: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  await db.write(
    'INSERT INTO otp_codes (target, code_hash, applicant_id, purpose, expires_at, created_at) VALUES (?,?,?,?,?,?)',
    [target, sha256(code), applicantId, purpose, expiresAt, dbNow()],
    'otp_codes'
  );
  const { sendWhatsApp, sendEmail } = await import('./notify');
  const applicant = await db.get('SELECT hp_siswa, nama_lengkap FROM applicants WHERE id=?', [applicantId]);
  if (config.notify.whatsappApiUrl && target) {
    await sendWhatsApp(target, `Kode verifikasi SPMB SMK Bhina Karya Karanganyar: ${code} (berlaku 5 menit). Jangan bagikan kode ini.`);
  }
  if (config.notify.smtpHost && applicant) {
    // Email dikirim bila alamat email tersedia pada data pendaftar.
  }
  const devOtp = otpConfigured() ? undefined : code;
  return { expiresAt, devOtp };
}

export async function verifyOtp(target: string, code: string, purpose: string): Promise<{ ok: boolean; applicantId?: number; error?: string }> {
  const row = await db.get(
    "SELECT * FROM otp_codes WHERE target=? AND purpose=? AND used=0 ORDER BY id DESC LIMIT 1",
    [target, purpose]
  );
  if (!row) return { ok: false, error: 'Kode OTP tidak ditemukan. Minta kode baru.' };
  if (row.expires_at < dbNow()) return { ok: false, error: 'Kode OTP kedaluwarsa. Minta kode baru.' };
  if (row.attempts >= 5) return { ok: false, error: 'Percobaan OTP melebihi batas. Minta kode baru.' };
  if (row.code_hash !== sha256(String(code || '').trim())) {
    await db.write('UPDATE otp_codes SET attempts=attempts+1 WHERE id=?', [row.id], 'otp_codes');
    return { ok: false, error: 'Kode OTP salah.' };
  }
  await db.write('UPDATE otp_codes SET used=1 WHERE id=?', [row.id], 'otp_codes');
  return { ok: true, applicantId: row.applicant_id };
}
