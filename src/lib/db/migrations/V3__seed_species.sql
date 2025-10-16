-- 初始物種資料（存在就忽略）
INSERT OR IGNORE INTO species (key, common_name, scientific_name, notes, created_at, updated_at) VALUES
  ('sulcata',         '蘇卡達象龜',        'Centrochelys sulcata',      NULL, datetime('now'), datetime('now')),
  ('argentine_tegu',  '南美巨蜥',          'Salvator merianae',         NULL, datetime('now'), datetime('now')),
  ('aft_gecko',       '肥尾守宮',          'Hemitheconyx caudicinctus', NULL, datetime('now'), datetime('now'));
