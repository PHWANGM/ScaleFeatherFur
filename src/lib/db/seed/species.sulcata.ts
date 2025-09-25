// src/lib/db/seed/species.sulcata.ts
import { execute } from '../db.client';
import { nowIso } from '../repos/_helpers';

export async function seedSulcata() {
  const iso = nowIso();
  await execute(
    `INSERT OR IGNORE INTO species (key, common_name, scientific_name, notes, created_at, updated_at)
     VALUES ('sulcata', '蘇卡達象龜', 'Centrochelys sulcata', '耐熱、需高 UVI', ?, ?)`,
    [iso, iso]
  );
}
