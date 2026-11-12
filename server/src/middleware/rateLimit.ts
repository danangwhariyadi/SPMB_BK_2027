import { Request, Response, NextFunction } from 'express';

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Rate limiter in-memory (token bucket) per IP + kategori rute.
 * Untuk produksi multi-instance, ganti dengan Redis.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  const refillRate = opts.max / opts.windowMs;
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${opts.key || req.path}:${req.ip}`;
    const nowMs = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: opts.max, last: nowMs };
      buckets.set(key, b);
    }
    b.tokens = Math.min(opts.max, b.tokens + (nowMs - b.last) * refillRate);
    b.last = nowMs;
    if (b.tokens < 1) {
      res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
      return;
    }
    b.tokens -= 1;
    next();
  };
}

/** Limiter persisten untuk login publik (proteksi brute force PIN). */
export async function checkPublicAttempts(key: string, maxAttempts: number, lockMinutes: number): Promise<{ allowed: boolean; remaining: number }> {
  const { db } = await import('../db');
  const row = await db.get('SELECT * FROM public_login_attempts WHERE attempt_key=?', [key]);
  const nowIso = new Date().toISOString();
  if (row && row.locked_until && row.locked_until > nowIso) {
    return { allowed: false, remaining: 0 };
  }
  const attempts = row && row.locked_until && row.locked_until <= nowIso ? 0 : row?.attempts ?? 0;
  return { allowed: attempts < maxAttempts, remaining: Math.max(0, maxAttempts - attempts) };
}

export async function recordFailedAttempt(key: string, maxAttempts: number, lockMinutes: number): Promise<void> {
  const { db } = await import('../db');
  const nowIso = new Date().toISOString();
  const row = await db.get('SELECT * FROM public_login_attempts WHERE attempt_key=?', [key]);
  if (row) {
    const attempts = row.attempts + 1;
    const locked = attempts >= maxAttempts;
    await db.write(
      'UPDATE public_login_attempts SET attempts=?, locked_until=?, updated_at=? WHERE attempt_key=?',
      [locked ? attempts : attempts, locked ? new Date(Date.now() + lockMinutes * 60000).toISOString() : null, nowIso, key],
      'public_login_attempts', key
    );
  } else {
    await db.write(
      'INSERT INTO public_login_attempts (attempt_key, attempts, locked_until, updated_at) VALUES (?,?,?,?)',
      [key, 1, maxAttempts <= 1 ? new Date(Date.now() + lockMinutes * 60000).toISOString() : null, nowIso],
      'public_login_attempts', key
    );
  }
}

export async function clearAttempts(key: string): Promise<void> {
  const { db } = await import('../db');
  await db.write('DELETE FROM public_login_attempts WHERE attempt_key=?', [key], 'public_login_attempts', key);
}
