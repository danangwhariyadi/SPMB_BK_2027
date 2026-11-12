import fs from 'fs';
import path from 'path';
import { DBAdapter, QueryResult } from './adapter';
import { SqliteAdapter } from './sqlite';
import { MariaDbAdapter, MariaDbConfig } from './mariadb';
import { D1Adapter } from './d1';

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

class DatabaseManager {
  private adapters: DBAdapter[] = [];
  private primary!: DBAdapter;
  private ready = false;

  get dialect() { return this.primary.dialect; }
  get primaryName() { return this.primary.name; }
  get secondaries(): DBAdapter[] { return this.adapters.filter(a => a !== this.primary); }

  async init(): Promise<void> {
    const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
    const sqliteFile = process.env.SQLITE_FILE || path.join(dataDir, 'spmb.db');

    const local = new SqliteAdapter(sqliteFile, 'sqlite-local', true);
    await local.connect();
    await this.initSchema(local, path.resolve(__dirname, 'schema.sqlite.sql'));
    this.adapters.push(local);

    if (process.env.MARIADB_HOST) {
      const cfg: MariaDbConfig = {
        host: process.env.MARIADB_HOST,
        port: parseInt(process.env.MARIADB_PORT || '3306', 10),
        user: process.env.MARIADB_USER || 'spmb',
        password: process.env.MARIADB_PASSWORD || '',
        database: process.env.MARIADB_DATABASE || 'spmb_bhina_karya',
      };
      try {
        const maria = new MariaDbAdapter(cfg, 'mariadb', true);
        await maria.connect();
        await this.initSchema(maria, path.resolve(__dirname, 'schema.mysql.sql'));
        this.adapters.push(maria);
        this.primary = maria;
        local.isPrimary = false;
      } catch (e: any) {
        console.error('[db] MariaDB unavailable, fallback to local SQLite:', e.message);
        this.primary = local;
      }
    } else {
      this.primary = local;
    }

    if (process.env.D1_ACCOUNT_ID && process.env.D1_DATABASE_ID && process.env.D1_API_TOKEN) {
      try {
        const d1 = new D1Adapter(process.env.D1_ACCOUNT_ID, process.env.D1_DATABASE_ID, process.env.D1_API_TOKEN);
        await d1.connect();
        await this.initSchema(d1, path.resolve(__dirname, 'schema.sqlite.sql'));
        this.adapters.push(d1);
      } catch (e: any) {
        console.error('[db] Cloudflare D1 unavailable:', e.message);
      }
    }

    console.log(`[db] primary=${this.primary.name}, adapters=${this.adapters.map(a => a.name).join(', ')}`);
    this.ready = true;
  }

  private async initSchema(adapter: DBAdapter, schemaFile: string): Promise<void> {
    const sql = fs.readFileSync(schemaFile, 'utf-8');
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await adapter.exec(stmt);
      } catch (e: any) {
        if (!/already exists/i.test(e.message || '')) {
          console.error(`[db:${adapter.name}] schema error: ${e.message}`);
        }
      }
    }
  }

  assertReady(): void {
    if (!this.ready) throw new Error('Database not initialized');
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    this.assertReady();
    return this.primary.query(sql, params);
  }

  async get(sql: string, params: any[] = []): Promise<any | null> {
    const { rows } = await this.query(sql, params);
    return rows[0] ?? null;
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    const { rows } = await this.query(sql, params);
    return rows;
  }

  /**
   * Write-through: eksekusi di primary lalu fan-out ke semua database
   * sekunder (MariaDB <-> SQLite <-> D1) agar tetap tersinkron.
   * Kegagalan sekunder dicatat di sync_log dan diulang oleh reconcile().
   */
  async write(sql: string, params: any[] = [], table = '', rowId?: string): Promise<QueryResult> {
    this.assertReady();
    const res = await this.primary.query(sql, params);
    const id = rowId ?? (res.lastID !== undefined ? String(res.lastID) : undefined);
    for (const sec of this.secondaries) {
      try {
        await sec.query(sql, params);
      } catch (e: any) {
        await this.primary.query(
          'INSERT INTO sync_log (target, table_name, op, row_id, payload, status, error, created_at) VALUES (?,?,?,?,?,?,?,?)',
          [sec.name, table || 'unknown', sql.slice(0, 60), id ?? null, JSON.stringify(params).slice(0, 2000), 'pending', String(e.message).slice(0, 500), now()]
        );
      }
    }
    return res;
  }

  async writeMany(statements: Array<{ sql: string; params?: any[] }>, table = ''): Promise<void> {
    for (const s of statements) {
      await this.primary.query(s.sql, s.params ?? []);
    }
    for (const sec of this.secondaries) {
      for (const s of statements) {
        try {
          await sec.query(s.sql, s.params ?? []);
        } catch (e: any) {
          await this.primary.query(
            'INSERT INTO sync_log (target, table_name, op, row_id, payload, status, error, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [sec.name, table, s.sql.slice(0, 60), null, JSON.stringify(s.params ?? []).slice(0, 2000), 'pending', String(e.message).slice(0, 500), now()]
          );
        }
      }
    }
  }

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    this.assertReady();
    return this.primary.transaction(fn);
  }

  /** Ulangi operasi tulis ke sekunder yang gagal. */
  async reconcile(): Promise<{ retried: number; success: number }> {
    const pending = await this.all("SELECT * FROM sync_log WHERE status='pending' ORDER BY id ASC LIMIT 200");
    let success = 0;
    for (const log of pending) {
      const sec = this.adapters.find(a => a.name === log.target);
      if (!sec) continue;
      try {
        await sec.query(log.op, JSON.parse(log.payload || '[]'));
        await this.primary.query("UPDATE sync_log SET status='synced', retried_at=? WHERE id=?", [now(), log.id]);
        success++;
      } catch {
        /* tetap pending, dicoba lagi pada siklus berikutnya */
      }
    }
    return { retried: pending.length, success };
  }

  async close(): Promise<void> {
    for (const a of this.adapters) await a.close();
  }
}

export const db = new DatabaseManager();
export { now as dbNow };
