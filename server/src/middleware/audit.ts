import { Request } from 'express';
import { db, dbNow } from '../db';

export async function audit(req: Request, action: string, entity: string, entityId: string | number | null, detail: string): Promise<void> {
  const user = req.user;
  await db.write(
    'INSERT INTO audit_logs (user_id, username, role_code, action, entity, entity_id, detail, ip, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [
      user?.id ?? null,
      user?.username ?? 'public',
      user?.role_code ?? '-',
      action,
      entity,
      entityId !== null ? String(entityId) : null,
      detail.slice(0, 1000),
      req.ip || '',
      dbNow(),
    ],
    'audit_logs'
  );
}
