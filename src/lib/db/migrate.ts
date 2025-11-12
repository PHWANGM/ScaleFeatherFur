// src/lib/db/migrate.ts
import { execute, query } from './db.client';
import { MIGRATIONS, readMigrationSql } from './migrations/index';

type Applied = { name: string };

async function runStatementsInTransaction(statements: string[]) {
  // 讀取目前 foreign_keys 狀態
  const fkStatus = await query<{ foreign_keys: number }>(`PRAGMA foreign_keys;`);
  const wasFKOn = (fkStatus[0]?.foreign_keys ?? 1) === 1;

  try {
    await execute('BEGIN IMMEDIATE');
    // 關掉 FK，避免「重建表」過程被阻擋；結束時會還原
    await execute('PRAGMA foreign_keys=OFF');

    for (const stmt of statements) {
      if (!stmt) continue;
      await execute(stmt);
    }

    // 還原 FK
    await execute(`PRAGMA foreign_keys=${wasFKOn ? 'ON' : 'OFF'}`);
    await execute('COMMIT');
  } catch (err) {
    try { await execute('ROLLBACK'); } catch { /* ignore */ }
    // 嘗試還原 FK 狀態（即使 rollback 之後）
    try { await execute(`PRAGMA foreign_keys=${wasFKOn ? 'ON' : 'OFF'}`); } catch { /* ignore */ }
    throw err;
  }
}

export async function runMigrations() {
  // migrations 表（若尚未建立）
  await execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = await query<Applied>(`SELECT name FROM migrations ORDER BY id ASC`);
  const appliedSet = new Set(applied.map(a => a.name));

  for (const m of MIGRATIONS) {
    if (appliedSet.has(m.name)) continue;

    const sql = await readMigrationSql(m);

    // 簡易多語句切割（避免丟失行尾分號；不處理 triggers/procedures 的 END 區塊，若未來用到可改以 sentinel 包裝）
    const statements = sql
      .replace(/\r\n/g, '\n')
      .split(/;\s*(?=\n|$)/g)  // 以分號 + 行尾/檔尾切割
      .map(s => s.trim())
      .filter(Boolean);

    await runStatementsInTransaction(statements);

    const now = new Date().toISOString();
    await execute(
      `INSERT INTO migrations (name, applied_at) VALUES (?, ?)`,
      [m.name, now]
    );
    appliedSet.add(m.name);
  }
}
