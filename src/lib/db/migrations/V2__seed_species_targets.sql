-- ===== Species seed =====
INSERT OR IGNORE INTO species (key, common_name, scientific_name, notes, created_at, updated_at) VALUES
  ('sulcata',        '蘇卡達象龜',          'Centrochelys sulcata',      NULL, datetime('now'), datetime('now')),
  ('argentine_tegu', '南美巨蜥',            'Salvator merianae',         NULL, datetime('now'), datetime('now')),
  ('aft_gecko',      '肥尾守宮',            'Hemitheconyx caudicinctus', NULL, datetime('now'), datetime('now'));

-- ===== species_targets v2 seed =====
-- 欄位對應：
-- id, species_key, life_stage,
-- uvb_intensity_min, uvb_intensity_max,
-- uvb_daily_hours_min, uvb_daily_hours_max,
-- photoperiod_hours_min, photoperiod_hours_max,
-- ambient_temp_c_min, ambient_temp_c_max,
-- feeding_interval_hours_min, feeding_interval_hours_max,
-- diet_note,
-- vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
-- temp_ranges_json, extra_json, created_at, updated_at

/* Sulcata Tortoise — 幼體：每日一次；成體：每 1–2 天一次 */
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage,
 uvb_intensity_min, uvb_intensity_max,
 uvb_daily_hours_min, uvb_daily_hours_max,
 photoperiod_hours_min, photoperiod_hours_max,
 ambient_temp_c_min, ambient_temp_c_max,
 feeding_interval_hours_min, feeding_interval_hours_max,
 diet_note,
 vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
 temp_ranges_json, extra_json, created_at, updated_at)
VALUES
  -- juvenile
  ('sulcata_juv','sulcata','juvenile',
   10, 12,
   10, 12,
   10, 12,
   22, 40,
   24, 24,
   '草食性；≥90% 高纖牧草（如提摩西等），<10% 深色蔬菜，水果極少量（<1%）；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[22,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),
  -- adult
  ('sulcata_adult','sulcata','adult',
   10, 12,
   10, 12,
   10, 12,
   22, 40,
   24, 48,
   '草食性；≥90% 高纖牧草（如提摩西等），<10% 深色蔬菜，水果極少量（<1%）；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[22,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));



/* Argentine Tegu — 幼體：每日一次；成體：每週 2–3 次（約每 56–84 小時一次） */
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage,
 uvb_intensity_min, uvb_intensity_max,
 uvb_daily_hours_min, uvb_daily_hours_max,
 photoperiod_hours_min, photoperiod_hours_max,
 ambient_temp_c_min, ambient_temp_c_max,
 feeding_interval_hours_min, feeding_interval_hours_max,
 diet_note,
 vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
 temp_ranges_json, extra_json, created_at, updated_at)
VALUES
  -- juvenile
  ('tegu_juv','argentine_tegu','juvenile',
   10, 12,
   10, 12,
   10, 12,
   24, 40,
   24, 24,
   '雜食：幼體約 70% 昆蟲/肉、30% 蔬果；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[24,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),
  -- adult
  ('tegu_adult','argentine_tegu','adult',
   10, 12,
   10, 12,
   10, 12,
   24, 40,
   56, 84,
   '雜食：成體約 60% 肉（可全食，如鼠/雞/魚）、30% 蔬菜、10% 水果；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[24,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));



/* African Fat-tailed Gecko — 幼體：每日一次；成體：每 2–3 天一次 */
-- UVB% 2–5，但表中未提供 UVB 時數；以下保留 uvb_daily_hours_* 與 photoperiod_* 為 NULL
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage,
 uvb_intensity_min, uvb_intensity_max,
 uvb_daily_hours_min, uvb_daily_hours_max,
 photoperiod_hours_min, photoperiod_hours_max,
 ambient_temp_c_min, ambient_temp_c_max,
 feeding_interval_hours_min, feeding_interval_hours_max,
 diet_note,
 vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
 temp_ranges_json, extra_json, created_at, updated_at)
VALUES
  -- juvenile
  ('aft_juv','aft_gecko','juvenile',
   2, 5,
   NULL, NULL,
   NULL, NULL,
   24, 32,
   24, 24,
   '食蟲：主食蟋蟀、杜比亞、麵包蟲；偶爾蠟蟲/蠶作補充；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[24,32]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),
  -- adult
  ('aft_adult','aft_gecko','adult',
   2, 5,
   NULL, NULL,
   NULL, NULL,
   24, 32,
   48, 72,
   '食蟲：主食蟋蟀、杜比亞、麵包蟲；偶爾蠟蟲/蠶作補充；撒純鈣粉（無 D3）。',
   72, 96,
   '{"ambient":[24,32]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));
