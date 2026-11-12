import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DBAdapter, Dialect, QueryResult, TransactionCtx } from './adapter';

export class SqliteAdapter implements DBAdapter {
  readonly name: string;
  readonly dialect: Dialect = 'sqlite';
  isPrimary: boolean;
  private db: Database.Database | null = null;
  private file: string;

  constructor(file: string, name = 'sqlite-local', isPrimary = false) {
    this.file = file;
    this.name = name;
    this.isPrimary = isPrimary;
  }

  async connect(): Promise<void> {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = new Database(this.file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) throw new Error('SQLite not connected');
    const stmt = this.db.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
      return { rows: stmt.all(...params) };
    }
    const info = stmt.run(...params);
    return { rows: [], lastID: Number(info.lastInsertRowid), changes: info.changes };
  }

  async exec(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  async transaction<T>(fn: (tx: TransactionCtx) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('SQLite not connected');
    let lastID: number | undefined;
    const ctx: TransactionCtx = {
      query: async (sql, params = []) => {
        const r = await this.query(sql, params);
        if (r.lastID !== undefined) lastID = r.lastID;
        return r;
      },
      exec: async (sql, params = []) => {
        const r = await this.query(sql, params);
        if (r.lastID !== undefined) lastID = r.lastID;
        return r;
      },
      get lastID() { return lastID; },
    };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = await fn(ctx);
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
