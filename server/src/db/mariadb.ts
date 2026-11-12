import mysql from 'mysql2/promise';
import { DBAdapter, Dialect, QueryResult, TransactionCtx } from './adapter';

export interface MariaDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class MariaDbAdapter implements DBAdapter {
  readonly name: string;
  readonly dialect: Dialect = 'mysql';
  readonly isPrimary: boolean;
  private pool: mysql.Pool | null = null;
  private cfg: MariaDbConfig;

  constructor(cfg: MariaDbConfig, name = 'mariadb', isPrimary = true) {
    this.cfg = cfg;
    this.name = name;
    this.isPrimary = isPrimary;
  }

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      ...this.cfg,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      multipleStatements: true,
      dateStrings: true,
    });
    await this.pool.query('SELECT 1');
  }

  private async runOn(conn: mysql.PoolConnection | mysql.Pool, sql: string, params: any[]): Promise<QueryResult> {
    const [result] = await conn.query(sql, params);
    if (Array.isArray(result)) {
      return { rows: result as any[] };
    }
    const r = result as mysql.ResultSetHeader;
    return { rows: [], lastID: r.insertId, changes: r.affectedRows };
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.pool) throw new Error('MariaDB not connected');
    return this.runOn(this.pool, sql, params);
  }

  async exec(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  async transaction<T>(fn: (tx: TransactionCtx) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('MariaDB not connected');
    const conn = await this.pool.getConnection();
    let lastID: number | undefined;
    try {
      await conn.beginTransaction();
      const ctx: TransactionCtx = {
        query: async (sql, params = []) => {
          const r = await this.runOn(conn, sql, params);
          if (r.lastID !== undefined) lastID = r.lastID;
          return r;
        },
        exec: async (sql, params = []) => {
          const r = await this.runOn(conn, sql, params);
          if (r.lastID !== undefined) lastID = r.lastID;
          return r;
        },
        get lastID() { return lastID; },
      };
      const out = await fn(ctx);
      await conn.commit();
      return out;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }
}
