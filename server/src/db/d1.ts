import { DBAdapter, Dialect, QueryResult, TransactionCtx } from './adapter';

/**
 * Cloudflare D1 adapter (fallback & sinkronisasi via HTTP REST API).
 * Aktif hanya jika D1_ACCOUNT_ID, D1_DATABASE_ID, D1_API_TOKEN diisi.
 */
export class D1Adapter implements DBAdapter {
  readonly name = 'cloudflare-d1';
  readonly dialect: Dialect = 'sqlite';
  readonly isPrimary = false;
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private endpoint: string;

  constructor(accountId: string, databaseId: string, apiToken: string) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.apiToken = apiToken;
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  async connect(): Promise<void> {
    const res = await this.raw('SELECT 1 AS ok');
    if (!res.success) throw new Error('D1 connection failed');
  }

  private async raw(sql: string, params: any[] = []): Promise<any> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) throw new Error(`D1 HTTP ${res.status}`);
    return res.json();
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const data = await this.raw(sql, params);
    if (!data.success) throw new Error('D1 query failed: ' + JSON.stringify(data.errors));
    const first = data.result?.[0];
    return { rows: first?.results ?? [], changes: first?.meta?.changes ?? 0 };
  }

  async exec(sql: string, params: any[] = []): Promise<QueryResult> {
    return this.query(sql, params);
  }

  async transaction<T>(fn: (tx: TransactionCtx) => Promise<T>): Promise<T> {
    const ctx: TransactionCtx = {
      query: (sql, params = []) => this.query(sql, params),
      exec: (sql, params = []) => this.query(sql, params),
    };
    return fn(ctx);
  }

  async close(): Promise<void> {
    /* HTTP adapter: nothing to close */
  }
}
