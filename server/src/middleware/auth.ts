import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getPerm } from './rbac';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role_code: string;
  type: 'staff';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      applicantSession?: { applicantId: number; registrationNumber: string };
    }
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.accessTokenTtl } as jwt.SignOptions);
}

export function signRefreshToken(user: AuthUser): string {
  return jwt.sign({ ...user, rt: true }, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    if (payload.rt) return null;
    return { id: payload.id, username: payload.username, full_name: payload.full_name, role_code: payload.role_code, type: 'staff' };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret) as any;
    if (!payload.rt) return null;
    return { id: payload.id, username: payload.username, full_name: payload.full_name, role_code: payload.role_code, type: 'staff' };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? verifyAccessToken(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Sesi berakhir atau tidak valid. Silakan login kembali.' });
    return;
  }
  req.user = user;
  next();
}

/** RBAC: butuh izin pada menu tertentu. action: view|create|edit|delete */
export function requirePerm(menu: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Tidak terautentikasi' });
      return;
    }
    const perm = getPerm(req.user.role_code, menu);
    const ok = action === 'view' ? perm.can_view : action === 'create' ? perm.can_create : action === 'edit' ? perm.can_edit : perm.can_delete;
    if (!ok) {
      res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk menu ini.' });
      return;
    }
    next();
  };
}

/** Sesi calon siswa (cek/ubah pendaftaran) via token applicant-session. */
export function signApplicantSession(applicantId: number, registrationNumber: string): string {
  return jwt.sign({ applicantId, registrationNumber, type: 'applicant' }, config.jwtSecret, { expiresIn: '30m' });
}

export function requireApplicantSession(req: Request, res: Response, next: NextFunction): void {
  const header = (req.headers['x-applicant-token'] as string) || '';
  try {
    const payload = jwt.verify(header, config.jwtSecret) as any;
    if (payload.type !== 'applicant') throw new Error('bad type');
    req.applicantSession = { applicantId: payload.applicantId, registrationNumber: payload.registrationNumber };
    next();
  } catch {
    res.status(401).json({ error: 'Sesi pendaftaran berakhir. Silakan verifikasi ulang.' });
  }
}
