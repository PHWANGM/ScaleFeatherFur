// src/lib/db/seed/tasks.ts
import { execute } from '../db.client';
import { nowIso } from '../repos/_helpers';

export async function seedTasks() {
  const iso = nowIso();
  const items = [
    ['feed', '餵食', '每日餵食', 5],
    ['calcium', '補鈣', '每週 2-3 次', 10],
    ['uvb', 'UVB 曝曬', '每日充足日照或 UVB', 5],
    ['clean', '清潔環境', '定期清潔', 3],
    ['weigh', '量體重', '每週稱重', 8],
  ];
  for (const [key, title, desc, points] of items) {
    await execute(
      `INSERT OR IGNORE INTO tasks (key, title, description, points, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [key, title, desc, points, iso, iso]
    );
  }
}
