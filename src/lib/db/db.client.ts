// src/lib/db/db.client.ts
import * as SQLite from 'expo-sqlite';

// 單例資料庫（App 全域使用）
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// 測試替換（unit test 時可注入 :memory:）
let _overrideDb: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_overrideDb) return _overrideDb;
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('scale_feather_fur.db');
      // 重要：分開執行 PRAGMA（更穩定）
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      return db;
    })();
  }
  return _dbPromise;
}

/** 僅限測試：覆寫 DB 連線（例如 :memory:） */
export function __setTestDB(db: SQLite.SQLiteDatabase | null) {
  _overrideDb = db;
  if (db) _dbPromise = Promise.resolve(db);
  else _dbPromise = null;
}

export type SQLParams = (string | number | null)[];

export type ExecuteResult = {
  changes: number;        // 影響列數
  lastInsertRowid?: number | null;
};

export async function query<T = any>(sql: string, params: SQLParams = []): Promise<T[]> {
  const db = await getDB();
  try {
    const rows = await db.getAllAsync<T>(sql, params);
    return rows;
  } catch (err) {
    throw new Error(`DB query failed: ${(err as Error).message}\nSQL:\n${sql}`);
  }
}

export async function execute(sql: string, params: SQLParams = []): Promise<ExecuteResult> {
  const db = await getDB();
  try {
    const res = await db.runAsync(sql, params);
    return {
      changes: res.changes ?? 0,
      lastInsertRowid: (res.lastInsertRowId as number | null | undefined) ?? null,
    };
  } catch (err) {
    throw new Error(`DB execute failed: ${(err as Error).message}\nSQL:\n${sql}`);
  }
}

/**
 * 交易：提供簡化版 tx API（只能執行/查詢）
 * 用法：
 * await transaction(async (tx) => {
 *   await tx.execute('INSERT ...', [...]);
 *   const rows = await tx.query<Row>('SELECT ...', [...]);
 * });
 */
export async function transaction(
  fn: (tx: {
    execute: (sql: string, params?: SQLParams) => Promise<ExecuteResult>;
    query:   <T = any>(sql: string, params?: SQLParams) => Promise<T[]>;
  }) => Promise<void>
): Promise<void> {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    const txApi = {
      execute: (sql: string, params: SQLParams = []) =>
        db.runAsync(sql, params).then(res => ({
          changes: res.changes ?? 0,
          lastInsertRowid: (res.lastInsertRowId as number | null | undefined) ?? null,
        })),
      query:   <T = any>(sql: string, params: SQLParams = []) =>
        db.getAllAsync<T>(sql, params),
    };
    await fn(txApi);
  });
}
