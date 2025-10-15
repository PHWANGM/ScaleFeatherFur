PRAGMA foreign_keys = ON;

/* 2.1: 物種基本資料（若尚未建檔） */
INSERT OR IGNORE INTO species (key, common_name, scientific_name, notes, created_at, updated_at)
VALUES
  ('sulcata', '蘇卡達象龜', 'Centrochelys sulcata', NULL, datetime('now'), datetime('now')),
  ('argentine_tegu', '南美巨蜥', 'Salvator merianae', NULL, datetime('now'), datetime('now')),
  ('aft_gecko', '肥尾守宮', 'Hemitheconyx caudicinctus', NULL, datetime('now'), datetime('now'));

/* 2.2: species_targets（juvenile/adult 各一筆；若已存在則忽略） */

/* Sulcata Tortoise */
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage, uvb_spec, photoperiod_hours_min, photoperiod_hours_max,
 temp_ranges_json, diet_split_json, supplement_rules_json, extra_json, created_at, updated_at)
VALUES
  (
    'sulcata_juv', 'sulcata', 'juvenile', '10.0', 10, 12,
    '{"basking":[35,40],"hot":[29,35],"cool":[24,27],"ambient_day":[26,30],"ambient_night":[22,25]}',
    '{"greens":0.95,"insect":0.0,"meat":0.0,"fruit":0.01}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_week:1-2","vitamin_multi":"per_week:1"}',
    '{"notes":"高纖牧草為主，水果極少"}',
    datetime('now'), datetime('now')
  ),
  (
    'sulcata_adult', 'sulcata', 'adult', '10.0', 10, 12,
    '{"basking":[35,40],"hot":[29,35],"cool":[24,27],"ambient_day":[26,30],"ambient_night":[22,25]}',
    '{"greens":0.95,"insect":0.0,"meat":0.0,"fruit":0.01}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_week:1-2","vitamin_multi":"per_week:1"}',
    '{"notes":"與幼體相近，控制總量"}',
    datetime('now'), datetime('now')
  );

/* Argentine Tegu */
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage, uvb_spec, photoperiod_hours_min, photoperiod_hours_max,
 temp_ranges_json, diet_split_json, supplement_rules_json, extra_json, created_at, updated_at)
VALUES
  (
    'tegu_juv', 'argentine_tegu', 'juvenile', '10.0', 10, 12,
    '{"basking":[40,43],"hot":[33,38],"cool":[24,27],"ambient_day":[29,35],"ambient_night":[22,25]}',
    '{"greens":0.2,"insect":0.5,"meat":0.2,"fruit":0.1}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_week:1-2","vitamin_multi":"per_week:1"}',
    '{"notes":"幼體偏昆蟲/蛋白較高"}',
    datetime('now'), datetime('now')
  ),
  (
    'tegu_adult', 'argentine_tegu', 'adult', '10.0', 10, 12,
    '{"basking":[40,43],"hot":[33,38],"cool":[24,27],"ambient_day":[29,35],"ambient_night":[22,25]}',
    '{"greens":0.3,"insect":0.1,"meat":0.6,"fruit":0.1}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_week:1-2","vitamin_multi":"per_week:1"}',
    '{"notes":"成體肉類 60%、蔬菜 30%、水果 10%"}',
    datetime('now'), datetime('now')
  );

/* African Fat-tailed Gecko */
INSERT OR IGNORE INTO species_targets
(id, species_key, life_stage, uvb_spec, photoperiod_hours_min, photoperiod_hours_max,
 temp_ranges_json, diet_split_json, supplement_rules_json, extra_json, created_at, updated_at)
VALUES
  (
    'aft_juv', 'aft_gecko', 'juvenile', '2.0-5.0', 10, 12,
    '{"basking":[30,32],"hot":[27,30],"cool":[24,26],"ambient_day":[27,30],"ambient_night":[24,26]}',
    '{"greens":0.0,"insect":1.0,"meat":0.0,"fruit":0.0}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_2_weeks:1","vitamin_multi":"per_2_weeks:1"}',
    '{"notes":"晨昏型，UVB 低強度即可；底部加熱墊提供熱點"}',
    datetime('now'), datetime('now')
  ),
  (
    'aft_adult', 'aft_gecko', 'adult', '2.0-5.0', 10, 12,
    '{"basking":[30,32],"hot":[27,30],"cool":[24,26],"ambient_day":[27,30],"ambient_night":[24,26]}',
    '{"greens":0.0,"insect":1.0,"meat":0.0,"fruit":0.0}',
    '{"calcium_plain":"every_meal","calcium_d3":"per_2_weeks:1","vitamin_multi":"per_2_weeks:1"}',
    '{"notes":"以昆蟲為主，注意 dusting"}',
    datetime('now'), datetime('now')
  );
