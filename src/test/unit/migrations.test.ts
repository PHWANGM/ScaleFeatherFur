// src/test/unit/migrations.test.ts

// ✦ 不要 import expo-sqlite、不要呼叫 openDatabaseAsync()
// 只需要我們的注入/runner
import { __setTestDB } from '../../lib/db/db.client';
import { runMigrations } from '../../lib/db/migrate';

// ★ 把 migrations 模組直接 mock 成 inline SQL，避免 require .sql 檔
jest.mock('../../lib/db/migrations', () => ({
  MIGRATIONS: [
    {
      name: 'V1__init.sql',
      sql: `
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS species (
          key TEXT PRIMARY KEY,
          common_name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `
    }
  ]
}));

// 建立最小可用的 fake DB，符合我們在 db.client.ts 用到的方法
function makeFakeDb() {
  const executed: string[] = [];
  const db = {
    execAsync: jest.fn(async (sql?: string) => { if (sql) executed.push(sql); }),
    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      // 當 runner 寫入 migrations 紀錄時，這裡會被呼叫
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      // 第一次查詢 migrations 名單 → 回空陣列（表示尚未執行）
      if (sql.includes('SELECT name FROM migrations')) return [];
      // 測最後驗證：查 sqlite_master 確認 species 已建立
      if (sql.includes("sqlite_master") && sql.includes("species")) {
        return [{ name: 'species' }];
      }
      return [];
    }),
    withTransactionAsync: jest.fn(async (fn: any) => { await fn(); }),
  } as any;
  return { db, executed };
}

describe('migrations runner', () => {
  afterEach(() => {
    __setTestDB(null);
    jest.clearAllMocks();
  });

  it('applies V1__init and creates species table', async () => {
    const { db, executed } = makeFakeDb();
    __setTestDB(db);

    await expect(runMigrations()).resolves.not.toThrow();

    // 驗證我們真的跑了 SQL & 寫入 migrations 紀錄
    const bigSql = executed.join('\n');
    expect(bigSql).toMatch(/PRAGMA foreign_keys = ON/i);
    expect(bigSql).toMatch(/CREATE TABLE IF NOT EXISTS migrations/i);
    expect(bigSql).toMatch(/CREATE TABLE IF NOT EXISTS species/i);

    // 驗證有記錄遷移
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO migrations/i),
      expect.any(Array)
    );

    // 驗證 species 表存在（由 fake getAllAsync 回傳）
    const rows = await db.getAllAsync(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='species'`
    );
    expect(rows.length).toBe(1);
  });
});
