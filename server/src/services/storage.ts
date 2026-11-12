import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { hmac } from '../util/helpers';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export function validateUpload(mime: string, sizeBytes: number): { ok: boolean; error?: string } {
  if (!ALLOWED_MIME[mime]) return { ok: false, error: 'Format file harus JPG, PNG, atau PDF.' };
  if (sizeBytes > config.maxFileSizeMB * 1024 * 1024) {
    return { ok: false, error: `Ukuran file maksimal ${config.maxFileSizeMB} MB.` };
  }
  return { ok: true };
}

export function extForMime(mime: string): string {
  return ALLOWED_MIME[mime] || 'bin';
}

/** Simpan file ke storage privat dengan nama acak. Return path relatif. */
export function savePrivateFile(buffer: Buffer, mime: string): { relativePath: string; absolutePath: string } {
  const ext = extForMime(mime);
  const name = `${crypto.randomUUID()}.${ext}`;
  const aa = name.slice(0, 2);
  const dir = path.join(config.storageDir, aa);
  fs.mkdirSync(dir, { recursive: true });
  const absolutePath = path.join(dir, name);
  fs.writeFileSync(absolutePath, buffer);
  return { relativePath: `${aa}/${name}`, absolutePath };
}

export function readPrivateFile(relativePath: string): Buffer | null {
  const safe = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.join(config.storageDir, safe);
  if (!absolutePath.startsWith(config.storageDir)) return null;
  if (!fs.existsSync(absolutePath)) return null;
  return fs.readFileSync(absolutePath);
}

export function deletePrivateFile(relativePath: string): void {
  if (!relativePath) return;
  const safe = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.join(config.storageDir, safe);
  if (absolutePath.startsWith(config.storageDir) && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

/** Signed URL berbatas waktu (HMAC) untuk akses dokumen privat. */
export function makeSignedUrl(documentId: number, applicantId: number, ttlSec = config.signedUrlTtlSec): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = hmac(config.signedUrlSecret, `${documentId}:${applicantId}:${expires}`);
  return `/api/documents/${documentId}/file?applicantId=${applicantId}&expires=${expires}&signature=${sig}`;
}

export function verifySignedUrl(documentId: number, applicantId: number, expires: string, signature: string): boolean {
  const exp = parseInt(expires, 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = hmac(config.signedUrlSecret, `${documentId}:${applicantId}:${exp}`);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}
