-- === Core tables ===

CREATE TABLE IF NOT EXISTS species (
  key TEXT PRIMARY KEY,            -- 'sulcata', 'leopard_gecko', ...
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species_key TEXT NOT NULL REFERENCES species(key),
  birth_date TEXT,
  location_city TEXT,              -- e.g., 'Taipei'
  habitat TEXT CHECK (habitat IN ('indoor_uvb','outdoor_sun','mixed')) NOT NULL,
  avatar_uri TEXT,
  life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NULL, -- ← 已含 V2 新欄位
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pets_species    ON pets(species_key);
CREATE INDEX IF NOT EXISTS idx_pets_updated_at ON pets(updated_at);

-- care_logs（已是「最終版」結構）
CREATE TABLE IF NOT EXISTS care_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  -- 放寬 type 並納入 vitamin/heat/light 開關
  type TEXT CHECK (type IN (
    'feed','calcium','vitamin','uvb_on','uvb_off','heat_on','heat_off','clean','weigh'
  )) NOT NULL,
  -- 更精細的分類
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

-- env_readings（metric/zone/value 版本）
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

-- species_targets（物種/生命階段的合規目標）
CREATE TABLE IF NOT EXISTS species_targets (
  id TEXT PRIMARY KEY,
  species_key TEXT NOT NULL REFERENCES species(key),
  life_stage TEXT CHECK (life_stage IN ('juvenile','adult')) NOT NULL,
  uvb_spec TEXT,                 -- e.g., '10.0','12%','5.0','2.0'
  photoperiod_hours_min REAL,
  photoperiod_hours_max REAL,
  temp_ranges_json TEXT NOT NULL,        -- {"basking":[35,40],...}
  diet_split_json TEXT,                  -- {"greens":0.9,"insect":0.1,...}
  supplement_rules_json TEXT,            -- {"calcium_plain":"every_meal",...}
  extra_json TEXT,                       -- 其它自由欄（濕度/基質...）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (species_key, life_stage)
);
CREATE INDEX IF NOT EXISTS idx_species_targets_species ON species_targets(species_key);

-- 天氣/UVI 快取
CREATE TABLE IF NOT EXISTS weather_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_key TEXT NOT NULL,       -- city or "lat,lon"
  date TEXT NOT NULL,               -- YYYY-MM-DD
  uvi_max REAL,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(location_key, date)
);

-- 警報 & 規則
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

-- 點數與任務定義
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

-- migration runner 的紀錄表（若你的程式會另外建，也 OK）
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- 預設任務（存在則略過）
INSERT OR IGNORE INTO tasks (key, title, description, points, created_at, updated_at) VALUES
  ('vitamin','維他命補充','含 D3 或綜合維他命補充',5, datetime('now'), datetime('now')),
  ('heat',   '加熱設備管理','Basking 燈/加熱墊開關與維護',3, datetime('now'), datetime('now'));
