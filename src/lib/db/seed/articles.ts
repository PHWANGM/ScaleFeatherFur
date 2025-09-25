// src/lib/db/seed/articles.ts
import { execute } from '../db.client';
import { nowIso } from '../repos/_helpers';

export async function seedArticles() {
  const iso = nowIso();
  const items = [
    ['art_uvb_basics', 'UVB 基礎指南', '# UVB 對爬蟲的重要性...', 'sulcata', JSON.stringify(['UVB','beginner'])],
    ['art_diet_plan', '蘇卡達飲食規劃', '## 草食龜的飲食...', 'sulcata', JSON.stringify(['diet'])],
  ];
  for (const [id, title, body, species_key, tags] of items) {
    await execute(
      `INSERT OR IGNORE INTO articles (id, title, body_md, species_key, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, body, species_key, tags, iso, iso]
    );
  }
}
