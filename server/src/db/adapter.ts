export interface QueryResult {
  rows: any[];
  lastID?: number;
  changes?: number;
}

export type Dialect = 'sqlite' | 'mysql';

export interface DBAdapter {
  readonly name: string;
  readonly dialect: Dialect;
  readonly isPrimary: boolean;
  connect(): Promise<void>;
  query(sql: string, params?: any[]): Promise<QueryResult>;
  exec(sql: string, params?: any[]): Promise<QueryResult>;
  transaction<T>(fn: (tx: TransactionCtx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface TransactionCtx {
  query(sql: string, params?: any[]): Promise<QueryResult>;
  exec(sql: string, params?: any[]): Promise<QueryResult>;
  lastID?: number;
}
