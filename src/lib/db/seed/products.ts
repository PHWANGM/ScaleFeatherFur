// src/lib/db/seed/products.ts
import { execute } from '../db.client';
import { nowIso } from '../repos/_helpers';

export async function seedProducts() {
  const iso = nowIso();
  const items = [
    ['prod_uvb_01', 'UVB T5 燈管', 'BrandX', JSON.stringify(['UVB','sulcata']), 'https://example.com/uvb', 'TW'],
    ['prod_scale_01', '數位秤', 'BrandY', JSON.stringify(['weigh','tool']), 'https://example.com/scale', 'TW'],
  ];
  for (const [id, name, brand, tags, url, region] of items) {
    await execute(
      `INSERT OR IGNORE INTO products (id, name, brand, tags, affiliate_url, region, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, brand, tags, url, region, iso, iso]
    );
  }
}
