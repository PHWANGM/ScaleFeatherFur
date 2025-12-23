-- src/lib/db/migrations/V3__productSeed.sql
-- Seed products (with image_url + description)
PRAGMA foreign_keys = ON;

-- ✅ 若你是新裝/重建 DB：這裡順便確保 schema 有 image_url / description
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  tags TEXT,
  affiliate_url TEXT,
  region TEXT,
  image_url TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ✅ 固定 seed id，避免重跑重複；可重跑以更新內容（用 OR REPLACE）
INSERT OR REPLACE INTO products (
  id, name, brand, tags, affiliate_url, region, image_url, description, created_at, updated_at
) VALUES
  (
    'prod_seed_uvb_t5_12',
    'T5 UVB 12% 燈管（24W）',
    'Arcadia',
    '["UVB","lamp","t5","reptile"]',
    'https://example.com/affiliate/uvb-t5-12',
    'TW',
    'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=400&q=80',
    '高輸出 T5 UVB 燈管，適合日行性龜/蜥蜴；建議搭配反射罩提升效率。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_uvb_fixture',
    'T5 反射燈具支架（60cm）',
    'Arcadia',
    '["UVB","fixture","t5","reptile"]',
    'https://example.com/affiliate/uvb-fixture',
    'TW',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=400&q=80',
    '鋁製反射罩燈具，提高 UVB 與可見光投射效率；安裝簡單、耐用。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_thermostat',
    '數位溫控器（爬蟲加熱用）',
    'INKBIRD',
    '["heat","thermostat","safety"]',
    'https://example.com/affiliate/thermostat',
    'TW',
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80',
    '控制加熱墊/陶瓷燈，避免過熱風險；建議搭配 basking 區與冷區分區管理。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_hygrometer',
    '溫濕度計（小型）',
    'Xiaomi',
    '["humidity","temp","monitor"]',
    'https://example.com/affiliate/hygro',
    'TW',
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=400&q=80',
    '即時監控溫度/濕度，幫助調整噴霧、通風與加熱策略。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_calcium_plain',
    '爬蟲純鈣粉（無 D3）',
    'Repashy',
    '["supplement","calcium","no_d3"]',
    'https://example.com/affiliate/calcium-plain',
    'TW',
    'https://images.unsplash.com/photo-1589871117064-8cb2a3c08d5a?auto=format&fit=crop&w=400&q=80',
    '日常補鈣用（無 D3）；搭配 UVB 照射更佳，粉可用於昆蟲/蔬菜沾附。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_calcium_d3',
    '爬蟲鈣粉（含 D3）',
    'Zoo Med',
    '["supplement","calcium","d3"]',
    'https://example.com/affiliate/calcium-d3',
    'TW',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=400&q=80',
    '含 D3 補鈣配方；通常不建議天天用，頻率依物種與 UVB 供給調整。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_multivitamin',
    '爬蟲綜合維他命粉',
    'Rep-Cal',
    '["supplement","vitamin","multi"]',
    'https://example.com/affiliate/multivit',
    'TW',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=400&q=80',
    '補充微量元素與維生素；建議依照物種週期使用，避免過量。',
    datetime('now'),
    datetime('now')
  ),
  (
    'prod_seed_substrate_coco',
    '椰纖基質（保濕/鋪底）',
    'Zoo Med',
    '["substrate","humidity","coco"]',
    'https://example.com/affiliate/coco',
    'TW',
    'https://images.unsplash.com/photo-1615678857339-4e7b5a03bca1?auto=format&fit=crop&w=400&q=80',
    '保濕性佳，適合需要較高濕度的物種；建議定期更換並注意發霉。',
    datetime('now'),
    datetime('now')
  );
