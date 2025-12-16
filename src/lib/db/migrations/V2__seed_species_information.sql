-- ===== 物種保底種子 =====
INSERT OR IGNORE INTO species (key, common_name, scientific_name, notes, created_at, updated_at) VALUES
  ('sulcata',        '蘇卡達象龜',          'Centrochelys sulcata',      NULL, datetime('now'), datetime('now')),
  ('argentine_tegu', '南美巨蜥',            'Salvator merianae',         NULL, datetime('now'), datetime('now')),
  ('aft_gecko',      '肥尾守宮',            'Hemitheconyx caudicinctus', NULL, datetime('now'), datetime('now'));

-- ===== species_targets（覆寫，符合小時制 schema）=====
-- 欄位順序需與 schema 一致：
-- id, species_key, life_stage,
-- uvb_intensity_min, uvb_intensity_max,
-- uvb_daily_hours_min, uvb_daily_hours_max,
-- photoperiod_hours_min, photoperiod_hours_max,
-- ambient_temp_c_min, ambient_temp_c_max,
-- feeding_interval_hours_min, feeding_interval_hours_max,
-- diet_note,
-- vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
-- calcium_every_meals,
-- diet_veg_pct_min, diet_veg_pct_max,
-- diet_meat_pct_min, diet_meat_pct_max,
-- diet_fruit_pct_min, diet_fruit_pct_max,
-- temp_ranges_json, extra_json, created_at, updated_at

/* ---------- 蘇卡達象龜 (Sulcata) ---------- */
INSERT OR REPLACE INTO species_targets (
  id, species_key, life_stage,
  uvb_intensity_min, uvb_intensity_max,
  uvb_daily_hours_min, uvb_daily_hours_max,
  photoperiod_hours_min, photoperiod_hours_max,
  ambient_temp_c_min, ambient_temp_c_max,
  feeding_interval_hours_min, feeding_interval_hours_max,
  diet_note,
  vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
  calcium_every_meals,
  diet_veg_pct_min, diet_veg_pct_max,
  diet_meat_pct_min, diet_meat_pct_max,
  diet_fruit_pct_min, diet_fruit_pct_max,
  temp_ranges_json, extra_json, created_at, updated_at
) VALUES
  -- 幼體：23–25h
  ('sulcata_juv','sulcata','juvenile',
   10, 12,
   10, 12,
   NULL, NULL,
   22, 40,
   23, 25,
   '草食性 (Herbivore)\n• 90%+ 提摩西草等高纖維牧草。\n• <10% 十字花科深色蔬菜。\n• 極少量 (<1%) 水果作為零食。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天 (以小時存)
   1,               -- 每餐補鈣
   90, 100,
   0, 10,
   0, 1,
   '{"ambient":[22,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),

  -- 成體：24–48h
  ('sulcata_adult','sulcata','adult',
   10, 12,
   10, 12,
   NULL, NULL,
   22, 40,
   24, 48,
   '草食性 (Herbivore)\n• 90%+ 提摩西草等高纖維牧草。\n• <10% 十字花科深色蔬菜。\n• 極少量 (<1%) 水果作為零食。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天
   1,               -- 每餐補鈣
   90, 100,
   0, 10,
   0, 1,
   '{"ambient":[22,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));


/* ---------- 南美巨蜥 (Argentine Tegu) ---------- */
INSERT OR REPLACE INTO species_targets (
  id, species_key, life_stage,
  uvb_intensity_min, uvb_intensity_max,
  uvb_daily_hours_min, uvb_daily_hours_max,
  photoperiod_hours_min, photoperiod_hours_max,
  ambient_temp_c_min, ambient_temp_c_max,
  feeding_interval_hours_min, feeding_interval_hours_max,
  diet_note,
  vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
  calcium_every_meals,
  diet_veg_pct_min, diet_veg_pct_max,
  diet_meat_pct_min, diet_meat_pct_max,
  diet_fruit_pct_min, diet_fruit_pct_max,
  temp_ranges_json, extra_json, created_at, updated_at
) VALUES
  -- 幼體：23–25h
  ('tegu_juv','argentine_tegu','juvenile',
   10, 12,
   10, 12,
   NULL, NULL,
   24, 40,
   23, 25,
   '雜食性 (Omnivore)\n• 幼體：70% 昆蟲/肉類 (蟋蟀、杜比亞蟑螂、乳鼠)，30% 蔬果。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天
   1,               -- 每餐補鈣
   25, 35,
   65, 75,
   NULL, NULL,      -- 幼體水果占比未指定 → 以 NULL 表示
   '{"ambient":[24,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),

  -- 成體：48–72h
  ('tegu_adult','argentine_tegu','adult',
   10, 12,
   10, 12,
   NULL, NULL,
   24, 40,
   48, 72,
   '雜食性 (Omnivore)\n• 成體：60% 肉類(可全食)，30% 蔬菜，10% 水果。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天
   1,               -- 每餐補鈣
   25, 35,
   55, 65,
   5, 15,
   '{"ambient":[24,40]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));


/* ---------- 肥尾守宮 (AFT Gecko) ---------- */
INSERT OR REPLACE INTO species_targets (
  id, species_key, life_stage,
  uvb_intensity_min, uvb_intensity_max,
  uvb_daily_hours_min, uvb_daily_hours_max,
  photoperiod_hours_min, photoperiod_hours_max,
  ambient_temp_c_min, ambient_temp_c_max,
  feeding_interval_hours_min, feeding_interval_hours_max,
  diet_note,
  vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
  calcium_every_meals,
  diet_veg_pct_min, diet_veg_pct_max,
  diet_meat_pct_min, diet_meat_pct_max,
  diet_fruit_pct_min, diet_fruit_pct_max,
  temp_ranges_json, extra_json, created_at, updated_at
) VALUES
  -- 幼體：23–25h；UVB 時數未提供
  ('aft_juv','aft_gecko','juvenile',
   2, 5,
   NULL, NULL,
   NULL, NULL,
   24, 32,
   23, 25,
   '食蟲性 (Insectivore)\n• 100% 以昆蟲為食。\n• 主食：蟋蟀、杜比亞蟑螂、麵包蟲。\n• 偶爾可提供蠟蟲或蠶作為補充。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天
   1,               -- 每餐補鈣
   0, 0,
   100, 100,
   0, 0,
   '{"ambient":[24,32]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now')),

  -- 成體：48–72h；UVB 時數未提供
  ('aft_adult','aft_gecko','adult',
   2, 5,
   NULL, NULL,
   NULL, NULL,
   24, 32,
   48, 72,
   '食蟲性 (Insectivore)\n• 100% 以昆蟲為食。\n• 主食：蟋蟀、杜比亞蟑螂、麵包蟲。\n• 偶爾可提供蠟蟲或蠶作為補充。\n• 撒上純鈣粉(無D3)',
   72, 96,          -- 3~4 天
   1,               -- 每餐補鈣
   0, 0,
   100, 100,
   0, 0,
   '{"ambient":[24,32]}',
   '{"uvb_unit":"percent"}',
   datetime('now'), datetime('now'));
