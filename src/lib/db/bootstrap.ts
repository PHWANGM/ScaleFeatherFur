// src/lib/db/bootstrap.ts
import { getDB, query } from './db.client';
import { runMigrations } from './migrate';

let _ready: Promise<void> | null = null;

/**
 * 在 App 啟動時呼叫；保證：
 * 1) 開啟資料庫並套用 PRAGMA（在 getDB() 內）
 * 2) 依序執行所有 MIGRATIONS（runMigrations）
 * 這是一個單例 Promise，多次呼叫不會重複執行。
 */
export function ensureDBReady(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    // 1) 確保資料庫連線已建立，且 PRAGMA 已設定
    await getDB();
    // 2) 執行 migrations（只會對未執行的檔案生效）
    await runMigrations();
  })();
  return _ready;
}

/**
 * （選用）開發期間調試用：
 * 回傳目前所有資料表、已套用的 migrations 以及外鍵啟用狀態。
 */
export async function debugDbSnapshot(): Promise<{
  tables: string[];
  migrations: string[];
  foreignKeys: 0 | 1;
}> {
  await ensureDBReady();

  const tables = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  );

  // migrations 表可能是空的（第一次跑完才有資料）
  let migrations: { name: string }[] = [];
  try {
    migrations = await query<{ name: string }>(
      `SELECT name FROM migrations ORDER BY id ASC`
    );
  } catch {
    // 若還沒建 migrations 表，忽略即可
    migrations = [];
  }

  const fk = await query<{ foreign_keys: number }>(`PRAGMA foreign_keys;`);
  const foreignKeys = ((fk?.[0]?.foreign_keys ?? 0) ? 1 : 0) as 0 | 1;

  return {
    tables: tables.map(t => t.name),
    migrations: migrations.map(m => m.name),
    foreignKeys,
  };
}
