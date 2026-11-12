import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, dbNow } from '../db';
import { signAccessToken, signRefreshToken, verifyRefreshToken, requireAuth, AuthUser } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { audit } from '../middleware/audit';
import { getPerm, PERMISSIONS } from '../middleware/rbac';
import { config } from '../config';

const router = Router();

router.post('/login', rateLimit({ windowMs: 60000, max: 10, key: 'login' }), async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  const user = await db.get('SELECT * FROM users WHERE username=?', [String(username).trim()]);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  if (user.locked_until && user.locked_until > dbNow()) {
    return res.status(423).json({ error: 'Akun terkunci sementara akibat percobaan login gagal. Coba lagi nanti.' });
  }
  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lock = attempts >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null;
    await db.write('UPDATE users SET failed_attempts=?, locked_until=?, updated_at=? WHERE id=?',
      [attempts, lock, dbNow(), user.id], 'users', String(user.id));
    return res.status(401).json({ error: 'Username atau password salah.' });
  }
  await db.write('UPDATE users SET failed_attempts=0, locked_until=NULL, last_login_at=?, updated_at=? WHERE id=?',
    [dbNow(), dbNow(), user.id], 'users', String(user.id));
  const authUser: AuthUser = { id: user.id, username: user.username, full_name: user.full_name, role_code: user.role_code, type: 'staff' };
  const accessToken = signAccessToken(authUser);
  const refreshToken = signRefreshToken(authUser);
  res.cookie('spmb_refresh', refreshToken, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 3600 * 1000, path: '/api/auth/refresh',
  });
  await audit(req, 'login', 'users', user.id, `Login panitia: ${user.username}`);
  res.json({
    access_token: accessToken,
    user: { ...authUser, permissions: PERMISSIONS[user.role_code] || {} },
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.spmb_refresh;
  if (!token) return res.status(401).json({ error: 'Refresh token tidak ada.' });
  const user = verifyRefreshToken(token);
  if (!user) return res.status(401).json({ error: 'Refresh token tidak valid.' });
  const row = await db.get('SELECT * FROM users WHERE id=? AND is_active=1', [user.id]);
  if (!row) return res.status(401).json({ error: 'Akun tidak aktif.' });
  const accessToken = signAccessToken({ id: row.id, username: row.username, full_name: row.full_name, role_code: row.role_code, type: 'staff' });
  res.json({ access_token: accessToken });
});

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  res.clearCookie('spmb_refresh', { path: '/api/auth/refresh' });
  await audit(req, 'logout', 'users', req.user!.id, `Logout: ${req.user!.username}`);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await db.get('SELECT id, username, full_name, role_code, is_active FROM users WHERE id=?', [req.user!.id]);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  res.json({ user: { ...user, permissions: PERMISSIONS[user.role_code] || {} } });
});

router.get('/permissions/:role', requireAuth, async (req: Request, res: Response) => {
  res.json({ role: req.params.role, permissions: PERMISSIONS[req.params.role] || null, menus: Object.keys(getPerm(req.params.role, 'dashboard')) });
});

export default router;
