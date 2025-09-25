-- src/lib/db/migrations/V1__init.sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 基礎
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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species_key);

-- 任務/記錄
CREATE TABLE IF NOT EXISTS care_logs (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('feed','calcium','uvb_on','uvb_off','clean','weigh')) NOT NULL,
  value REAL,                      -- grams fed / weight / etc.
  note TEXT,
  at TEXT NOT NULL,                -- ISO datetime
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_logs_pet_at ON care_logs(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_care_logs_type ON care_logs(type);

CREATE TABLE IF NOT EXISTS env_readings (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  temp_c REAL,
  humidity REAL,
  lux REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_env_readings_pet_at ON env_readings(pet_id, at);

-- 天氣/UVI 快取
CREATE TABLE IF NOT EXISTS weather_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_key TEXT NOT NULL,      -- city or lat,lon
  date TEXT NOT NULL,              -- YYYY-MM-DD
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
  code TEXT NOT NULL,              -- e.g., 'UVI_TOO_HIGH'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommended_product_ids TEXT,    -- JSON array of product ids
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_pet_at ON alerts(pet_id, at);
CREATE INDEX IF NOT EXISTS idx_alerts_code ON alerts(code);

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
  region TEXT,                     -- e.g., 'TW','US' (可過濾)
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
  key TEXT PRIMARY KEY,            -- 'feed','calcium','uvb','clean','weigh'
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
  UNIQUE (pet_id, task_key, at)    -- 防重複打卡（同日/同時間片）
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

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
