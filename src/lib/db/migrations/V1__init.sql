-- V1__init.sql
-- 初始化資料庫（SQLite）
-- 單位說明：
-- - UVB 強度：百分比（%）
-- - UVB 每日照射：小時（hr）
-- - 溫度：攝氏（°C）
-- - 餵食頻率：每 X~Y 小時餵一次（依 life_stage）
-- - 含 D3 補充週期：小時（本檔使用 vitamin_d3_interval_hours_min/max）
-- - 鈣粉週期（calcium_every_meals）：每幾餐灑粉 1 次（1 = 每餐）

PRAGMA foreign_keys = ON;

-- === Core tables ===

-- 物種清單
CREATE TABLE IF NOT EXISTS species (
  key TEXT PRIMARY KEY,            -- 'sulcata', 'argentine_tegu', 'fat_tailed_gecko', ...
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 寵物個體
CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species_key TEXT NOT NULL REFERENCES species(key),
  birth_date TEXT,
  location_city TEXT,              -- e.g., 'Taipei'
  habitat TEXT CHECK (habitat IN ('indoor_uvb','outdoor_sun','mixed')) NOT NULL,
  avatar_uri TEXT,
  life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pets_species    ON pets(species_key);
CREATE INDEX IF NOT EXISTS idx_pets_updated_at ON pets(updated_at);

-- 照護紀錄
CREATE TABLE IF NOT EXISTS care_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN (
    'feed','calcium','vitamin','uvb_on','uvb_off','heat_on','heat_off','clean','weigh'
  )) NOT NULL,
  subtype  TEXT,   -- 'calcium_plain','calcium_d3','vitamin_multi','feed_greens','feed_meat','feed_insect','feed_fruit','uvb','basking_heat','heat_mat','insect_dusting'...
  category TEXT,   -- 'supplement','feed_insect','feed_meat','feed_greens','feed_fruit','light','heat','maint'...
  value REAL,      -- 數值（g/kg/分鐘/顆數等）
  unit  TEXT,      -- 'g','kg','pcs','min','h'...
  note TEXT,
  at   TEXT NOT NULL,  -- ISO datetime
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_logs_pet_at   ON care_logs(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_care_logs_type     ON care_logs(type);
CREATE INDEX IF NOT EXISTS idx_care_logs_category ON care_logs(category);
CREATE INDEX IF NOT EXISTS idx_care_logs_subtype  ON care_logs(subtype);

-- 環境讀數（metric/zone/value）
CREATE TABLE IF NOT EXISTS env_readings (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  metric TEXT CHECK (metric IN ('temp_c','humidity_pct','lux')) NOT NULL,
  zone TEXT,                 -- 'basking','hot','cool','ambient_day','ambient_night'...
  value REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_env_readings_pet_at      ON env_readings(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_env_readings_metric_zone ON env_readings(metric, zone);

-- 物種/生命階段的合規目標（以百分比/小時/餐數）
CREATE TABLE IF NOT EXISTS species_targets (
  id TEXT PRIMARY KEY,
  species_key TEXT NOT NULL REFERENCES species(key),
  life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NOT NULL,

  -- UVB（%）與每日照射（hr）
  uvb_intensity_min REAL,
  uvb_intensity_max REAL,
  uvb_daily_hours_min REAL,
  uvb_daily_hours_max REAL,

  -- 光週期（hr）
  photoperiod_hours_min REAL,
  photoperiod_hours_max REAL,

  -- 環境（°C）
  ambient_temp_c_min REAL,
  ambient_temp_c_max REAL,

  -- 餵食頻率（hr）
  feeding_interval_hours_min REAL,
  feeding_interval_hours_max REAL,

  -- 飲食備註（可放長文配方）
  diet_note TEXT,

  -- ★ 含 D3 週期（hr）
  vitamin_d3_interval_hours_min INTEGER,
  vitamin_d3_interval_hours_max INTEGER,

  -- ★ 鈣粉週期（幾餐 1 次；1=每餐）
  calcium_every_meals INTEGER,

  -- ★ 飲食組成（%）
  diet_veg_pct_min REAL,
  diet_veg_pct_max REAL,
  diet_meat_pct_min REAL,
  diet_meat_pct_max REAL,
  diet_fruit_pct_min REAL,
  diet_fruit_pct_max REAL,

  -- 可選細分
  temp_ranges_json TEXT, -- {"ambient":[min,max], "basking":[...]}
  extra_json TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- 合理性約束
  CHECK (uvb_intensity_min IS NULL OR uvb_intensity_max IS NULL OR uvb_intensity_min <= uvb_intensity_max),
  CHECK (uvb_daily_hours_min IS NULL OR uvb_daily_hours_max IS NULL OR uvb_daily_hours_min <= uvb_daily_hours_max),
  CHECK (ambient_temp_c_min IS NULL OR ambient_temp_c_max IS NULL OR ambient_temp_c_min <= ambient_temp_c_max),
  CHECK (feeding_interval_hours_min IS NULL OR feeding_interval_hours_max IS NULL OR feeding_interval_hours_min <= feeding_interval_hours_max),

  -- 百分比 0..100
  CHECK (diet_veg_pct_min IS NULL OR (diet_veg_pct_min BETWEEN 0 AND 100)),
  CHECK (diet_veg_pct_max IS NULL OR (diet_veg_pct_max BETWEEN 0 AND 100)),
  CHECK (diet_meat_pct_min IS NULL OR (diet_meat_pct_min BETWEEN 0 AND 100)),
  CHECK (diet_meat_pct_max IS NULL OR (diet_meat_pct_max BETWEEN 0 AND 100)),
  CHECK (diet_fruit_pct_min IS NULL OR (diet_fruit_pct_min BETWEEN 0 AND 100)),
  CHECK (diet_fruit_pct_max IS NULL OR (diet_fruit_pct_max BETWEEN 0 AND 100)),

  UNIQUE (species_key, life_stage)
);
CREATE INDEX IF NOT EXISTS idx_species_targets_species ON species_targets(species_key);

-- 天氣/UVI 快取（支援逐小時資料）
CREATE TABLE IF NOT EXISTS weather_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_key TEXT NOT NULL,                 -- 建議 "lat,lon"
  date TEXT NOT NULL,                         -- YYYY-MM-DD（以本地日為 key）
  tz TEXT,                                    -- 來源 API 的時區（例: 'Asia/Taipei'）
  lat REAL,
  lon REAL,

  -- 日彙總
  uvi_max REAL,

  -- 逐小時快取（JSON 陣列；通常長度 24）
  hourly_times_local_json TEXT NOT NULL DEFAULT '[]',   -- ["2025-11-11T17:00+08:00", ...]
  hourly_temp_c_json      TEXT NOT NULL DEFAULT '[]',   -- [23.1, 22.8, ...]
  hourly_cloudcover_json  TEXT NOT NULL DEFAULT '[]',   -- [0..100 的百分比]
  hourly_uv_index_json    TEXT NOT NULL DEFAULT '[]',   -- [0..11+]

  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE (location_key, date)
);
CREATE INDEX IF NOT EXISTS idx_weather_location_date ON weather_cache(location_key, date);

-- 警報
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info','warn','critical')) NOT NULL,
  code TEXT NOT NULL,             -- e.g., 'UVI_TOO_HIGH'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommended_product_ids TEXT,   -- JSON array of product ids
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_pet_at ON alerts(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_alerts_code   ON alerts(code);

-- 規則（以 YAML 為來源）
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,             -- matches YAML id
  species_key TEXT REFERENCES species(key),
  yaml TEXT NOT NULL,              -- source of truth for P0
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_species ON rules(species_key);

-- 產品/文章（情境解法）
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  tags TEXT,                       -- JSON array ['UVB','sulcata','high_uvi_alt']
  affiliate_url TEXT,
  region TEXT,                     -- 'TW','US'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  species_key TEXT REFERENCES species(key),
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_species ON articles(species_key);

CREATE TABLE IF NOT EXISTS article_products (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, product_id)
);

-- 點數與任務
CREATE TABLE IF NOT EXISTS points_ledger (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  reason TEXT NOT NULL,            -- e.g., 'task_complete:calcium'
  delta INTEGER NOT NULL,          -- + / -
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_pet_at ON points_ledger(pet_id, at);

CREATE TABLE IF NOT EXISTS tasks (               -- 任務定義（顯示於 UI）
  key TEXT PRIMARY KEY,            -- 'feed','calcium','uvb','clean','weigh','vitamin','heat'...
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_completion (     -- 任務完成記錄（與 care_logs 可疊加）
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL REFERENCES tasks(key),
  at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (pet_id, task_key, at)
);

-- 社群配對（P0 可本地模擬）
CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,              -- YYYY-MM-DD
  partner_hint TEXT,               -- 對方暱稱/物種等描述（P0 模擬）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (pet_id, date)
);

-- 設定/版本/同步占位
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- migration runner 的紀錄表
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- 預設任務（存在則略過）
INSERT OR IGNORE INTO tasks (key, title, description, points, created_at, updated_at) VALUES
  ('feed',   '餵食',           '飲食管理與餵食紀錄',                    5, datetime('now'), datetime('now')),
  ('calcium','鈣質補充',       '純鈣或含 D3 補充取決於物種與頻率',        5, datetime('now'), datetime('now')),
  ('vitamin','維他命補充',     '含 D3 或綜合維他命補充',                5, datetime('now'), datetime('now')),
  ('uvb',    'UVB 管理',       'UVB 燈具開關/維護/耗材更換',            3, datetime('now'), datetime('now')),
  ('heat',   '加熱設備管理',   'Basking 燈/加熱墊開關與維護',           3, datetime('now'), datetime('now')),
  ('clean',  '環境清潔',       'enclosure/水盆/基質清潔',               2, datetime('now'), datetime('now')),
  ('weigh',  '體重紀錄',       '定期量測與追蹤',                         2, datetime('now'), datetime('now'));
