// src/lib/db/migrate.ts
import { execute, query } from './db.client';
import { MIGRATIONS, readMigrationSql } from './migrations';

type Applied = { name: string };

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
    // 簡單切句；遇到複合語句可再強化
    const statements = sql
      .split(/;\s*$/m)       // 保留行尾分號的切割（簡單版）
      .flatMap(s => s.split(/;\s*(?=\n|$)/)) // 更保險
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await execute(stmt);
    }

    const now = new Date().toISOString();
    await execute(`INSERT INTO migrations (name, applied_at) VALUES (?, ?)`, [m.name, now]);
    appliedSet.add(m.name);
  }
}
