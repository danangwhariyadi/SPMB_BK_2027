import crypto from 'crypto';

export function normalizePhone(raw: string): string {
  let p = String(raw || '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+62')) p = '62' + p.slice(3);
  else if (p.startsWith('62')) p = '62' + p.slice(2);
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  return p;
}

export function isValidIndonesianPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  return /^62[8][0-9]{7,12}$/.test(p);
}

export function isValidNisn(nisn: string): boolean {
  return /^[0-9]{10}$/.test(String(nisn || '').trim());
}

/** Umur pada tanggal 10 Juli 2027 sesuai ketentuan formulir. */
export function ageAt10July2027(tanggalLahir: string): string {
  if (!tanggalLahir) return '';
  const ref = new Date(2027, 6, 10);
  const d = new Date(tanggalLahir);
  if (isNaN(d.getTime()) || d > ref) return '';
  let years = ref.getFullYear() - d.getFullYear();
  let months = ref.getMonth() - d.getMonth();
  let days = ref.getDate() - d.getDate();
  if (days < 0) {
    months--;
    days += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  const y = years > 0 ? `${years} tahun ` : '';
  return `${y}${months} bulan ${days} hari`.trim();
}

export function randomPin(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function hmac(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function sanitizeFileName(name: string): string {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
