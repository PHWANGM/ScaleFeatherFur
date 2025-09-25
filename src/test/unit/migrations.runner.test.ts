import * as SQLite from 'expo-sqlite';
import { __setTestDB } from '../../lib/db/db.client';
import { runMigrations } from '../../lib/db/migrate';
import { MIGRATIONS } from '../../lib/db/migrations';

// 建立一個最小可用的 fake DB，符合我們在 db.client.ts 用到的方法
function makeFakeDb() {
  const executed: string[] = [];
  const journalQueries: string[] = [];

  const db = {
    execAsync: jest.fn(async (sql?: string) => {
      if (sql) executed.push(sql);
      // 支援 PRAGMA journal_mode; 的讀取回傳
      if (sql?.trim().toLowerCase() === 'pragma journal_mode') {
        // do nothing here; this path is for real DB in smoke test
      }
    }),
    runAsync: jest.fn(async (_sql: string, _params?: any[]) => {
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('SELECT name FROM migrations')) return []; // 初次遷移
      return [];
    }),
    withTransactionAsync: jest.fn(async (fn: any) => {
      await fn();
    }),
  } as unknown as SQLite.SQLiteDatabase;

  return { db, executed, journalQueries };
}

describe('runMigrations (mocked DB)', () => {
  beforeAll(() => {
    // 用 inline SQL 覆蓋 MIGRATIONS，避免讀資產檔
    // @ts-ignore
    MIGRATIONS.splice(0, MIGRATIONS.length, {
      name: 'V1__init.sql',
      sql: `
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
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
      `,
    });
  });

  afterEach(() => {
    __setTestDB(null);
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('applies V1__init.sql and records migration', async () => {
    const { db, executed } = makeFakeDb();
    __setTestDB(db);

    await expect(runMigrations()).resolves.not.toThrow();

    // 有執行我們的 SQL（包含 PRAGMA 與 CREATE TABLE）
    const bigSql = executed.join('\n');
    expect(bigSql).toMatch(/PRAGMA foreign_keys = ON/i);
    expect(bigSql).toMatch(/PRAGMA journal_mode = WAL/i);
    expect(bigSql).toMatch(/CREATE TABLE IF NOT EXISTS migrations/i);
    expect(bigSql).toMatch(/CREATE TABLE IF NOT EXISTS species/i);

    // runMigrations 會在 tx 末寫入 migrations 紀錄
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO migrations/i),
      expect.any(Array)
    );
  });
});
