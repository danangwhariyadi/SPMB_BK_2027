import { db, dbNow } from '../db';
import { config } from '../config';

/**
 * Nomor pendaftaran atomic: increment terjadi di dalam transaksi database
 * primary sehingga tidak mungkin duplikat walau banyak pendaftar bersamaan.
 * Format diambil dari school_settings (default: A0001).
 */
export async function nextRegistrationNumber(tx?: any): Promise<{ number: string; prefix: string }> {
  const setting = await db.get("SELECT svalue FROM school_settings WHERE skey='format_no_pendaftaran'");
  const fmt = setting?.svalue || 'A{seq:4}';
  const m = fmt.match(/^([A-Z]*)\{seq:(\d+)\}$/);
  const prefix = m ? m[1] : 'A';
  const pad = m ? parseInt(m[2], 10) : 4;

  const run = async (ctx: any): Promise<string> => {
    const q = ctx ? ctx.query : (s: string, p?: any[]) => db.query(s, p);
    await q(
      'INSERT INTO registration_sequences (prefix, ta, last_number) VALUES (?,?,0)',
      [prefix, config.ta]
    ).catch(() => undefined);
    await q(
      'UPDATE registration_sequences SET last_number = last_number + 1 WHERE prefix=? AND ta=?',
      [prefix, config.ta]
    );
    const row = await q(
      'SELECT last_number FROM registration_sequences WHERE prefix=? AND ta=?',
      [prefix, config.ta]
    );
    const n = row.rows[0]?.last_number ?? 1;
    return `${prefix}${String(n).padStart(pad, '0')}`;
  };

  if (tx) return { number: await run(tx), prefix };
  return { number: await db.transaction(run), prefix };
}

/** Gelombang otomatis berdasarkan jadwal aktif dan tanggal server. */
export async function resolveActiveWave(): Promise<{ id: number; nama: string } | null> {
  const today = dbNow().slice(0, 10);
  const row = await db.get(
    'SELECT id, nama FROM registration_waves WHERE is_active=1 AND ? >= start_date AND ? <= end_date ORDER BY start_date ASC LIMIT 1',
    [today, today]
  );
  return row ? { id: row.id, nama: row.nama } : null;
}
