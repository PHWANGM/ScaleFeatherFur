PRAGMA foreign_keys = ON;

/* ========== 1) care_logs 擴充：subtype / unit / category，並放寬 type ========== */
/* SQLite 無法直接 drop CHECK，只能「重建表」：建立新表 -> 搬資料 -> 換名 -> 重建索引 */

-- 1.1 建立新版 care_logs
CREATE TABLE IF NOT EXISTS care_logs_v2 (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  /* 放寬 type，加入 vitamin / heat_on / heat_off */
  type TEXT CHECK (type IN (
    'feed','calcium','vitamin','uvb_on','uvb_off','heat_on','heat_off','clean','weigh'
  )) NOT NULL,
  /* ★ 新增：更精細的子分類與彙整用欄位與單位 */
  subtype TEXT,     -- e.g. 'calcium_plain','calcium_d3','vitamin_multi','feed_greens','feed_meat','feed_insect','feed_fruit','uvb','basking_heat','heat_mat','insect_dusting'
  category TEXT,    -- e.g. 'supplement','feed_insect','feed_meat','feed_greens','feed_fruit','light','heat'
  value REAL,       -- grams / kg / hours 數值（若用 on/off 計時，仍以事件記錄，彙總時計算）
  unit TEXT,        -- 'g','kg','pcs','min','h'...
  note TEXT,
  at TEXT NOT NULL,             -- ISO datetime
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 1.2 從舊表搬資料（盡力合理映射）
INSERT INTO care_logs_v2 (id, pet_id, type, subtype, category, value, unit, note, at, created_at, updated_at)
SELECT
  id,
  pet_id,
  type,                         -- 原 type 直接沿用；未有 vitamin/heat_* 的資料不受影響
  NULL AS subtype,
  CASE
    WHEN type = 'feed'    THEN 'feed_generic'
    WHEN type = 'calcium' THEN 'supplement'
    WHEN type LIKE 'uvb_%' THEN 'light'
    WHEN type IN ('weigh') THEN NULL
    WHEN type = 'clean'   THEN 'maint'
    ELSE NULL
  END AS category,
  value,
  NULL AS unit,
  note,
  at,
  created_at,
  updated_at
FROM care_logs;

-- 1.3 刪除舊索引、舊表並換名
DROP INDEX IF EXISTS idx_care_logs_pet_at;
DROP INDEX IF EXISTS idx_care_logs_type;
DROP TABLE care_logs;

ALTER TABLE care_logs_v2 RENAME TO care_logs;

-- 1.4 重建索引
CREATE INDEX IF NOT EXISTS idx_care_logs_pet_at ON care_logs(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_care_logs_type   ON care_logs(type);
CREATE INDEX IF NOT EXISTS idx_care_logs_category ON care_logs(category);
CREATE INDEX IF NOT EXISTS idx_care_logs_subtype  ON care_logs(subtype);




/* ========== 2) env_readings 重新設計為 metric/zone/value（保留資料） ========== */
/* 舊表結構：temp_c, humidity, lux -> 轉成多列記錄 */
/* metric 建議受控集合：'temp_c','humidity_pct','lux'；zone 受控：'basking','hot','cool','ambient_day','ambient_night' 等 */

CREATE TABLE IF NOT EXISTS env_readings_v2 (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  metric TEXT CHECK (metric IN ('temp_c','humidity_pct','lux')) NOT NULL,
  zone TEXT,               -- e.g. 'basking','hot','cool','ambient_day','ambient_night'
  value REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2.1 將舊資料盡力搬移：temp_c -> metric='temp_c'、humidity -> 'humidity_pct'、lux -> 'lux'
--    zone 先設為 NULL（舊資料無分區）
INSERT INTO env_readings_v2 (id, pet_id, at, metric, zone, value, created_at, updated_at)
SELECT
  id || ':t',
  pet_id,
  at,
  'temp_c',
  NULL,
  temp_c,
  created_at,
  updated_at
FROM env_readings
WHERE temp_c IS NOT NULL;

INSERT INTO env_readings_v2 (id, pet_id, at, metric, zone, value, created_at, updated_at)
SELECT
  id || ':h',
  pet_id,
  at,
  'humidity_pct',
  NULL,
  humidity,
  created_at,
  updated_at
FROM env_readings
WHERE humidity IS NOT NULL;

INSERT INTO env_readings_v2 (id, pet_id, at, metric, zone, value, created_at, updated_at)
SELECT
  id || ':l',
  pet_id,
  at,
  'lux',
  NULL,
  lux,
  created_at,
  updated_at
FROM env_readings
WHERE lux IS NOT NULL;

-- 2.2 移除舊表，替換為新表
DROP INDEX IF EXISTS idx_env_readings_pet_at;
DROP TABLE env_readings;

ALTER TABLE env_readings_v2 RENAME TO env_readings;
CREATE INDEX IF NOT EXISTS idx_env_readings_pet_at ON env_readings(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_env_readings_metric_zone ON env_readings(metric, zone);



/* ========== 3) pets 增加 life_stage（幼/成體）供規則比對 ========== */

ALTER TABLE pets ADD COLUMN life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NULL;

-- 可選：將既有寵物用年齡推估（此處僅預留欄位；實際填值交由應用邏輯）
-- UPDATE pets SET life_stage = 'juvenile' WHERE birth_date > date('now','-12 months');



/* ========== 4) species_targets：存放物種/生命階段的「合規目標」 ========== */
/* 用 JSON 欄位承載彈性目標，避免頻繁變更 schema */

CREATE TABLE IF NOT EXISTS species_targets (
  id TEXT PRIMARY KEY,
  species_key TEXT NOT NULL REFERENCES species(key),
  life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NOT NULL,
  uvb_spec TEXT,                 -- e.g. '10.0','12%','5.0','2.0'
  photoperiod_hours_min REAL,
  photoperiod_hours_max REAL,
  -- 溫度區間 JSON（例如：{"basking":[35,40],"hot":[29,35],"cool":[24,27],"ambient_day":[26,30],"ambient_night":[22,25]}）
  temp_ranges_json TEXT NOT NULL,
  -- 飲食比例 JSON（例如：{"greens":0.9,"insect":0.1,"meat":0.0,"fruit":0.01}）
  diet_split_json TEXT,
  -- 補充品規則 JSON（例如：{"calcium_plain":"every_meal","calcium_d3":"per_week:1-2","vitamin_multi":"per_week:1"}）
  supplement_rules_json TEXT,
  -- 其它自由欄位（濕度、基質、特備要求）
  extra_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (species_key, life_stage)
);



/* ========== 5) 任務定義（選擇性）：補上 vitamin / heat ========== */

INSERT OR IGNORE INTO tasks (key, title, description, points, created_at, updated_at)
VALUES
  ('vitamin', '維他命補充', '含 D3 或綜合維他命補充', 5, datetime('now'), datetime('now')),
  ('heat',    '加熱設備管理', 'Basking 燈/加熱墊開關與維護', 3, datetime('now'), datetime('now'));
