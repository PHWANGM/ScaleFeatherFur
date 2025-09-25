// src/test/mocks/expo-sqlite.ts
export type SQLiteRunResult = { changes?: number; lastInsertRowId?: number };
export type SQLiteDatabase = {
  execAsync: (sql?: string) => Promise<void>;
  runAsync: (sql: string, params?: any[]) => Promise<SQLiteRunResult>;
  getAllAsync: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
};

/**
 * 在單元測試中若有人直接呼叫 openDatabaseAsync，
 * 我們故意拋錯，強迫你改用 __setTestDB 注入測試用 DB。
 */
export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  throw new Error('openDatabaseAsync called in unit test. Use __setTestDB to inject a mock DB.');
}

/**
 * ===========================
 *  In-Memory Test DB Factory
 * ===========================
 * 用純 JS 模擬 SQLite；只覆蓋目前測試用得到的 SQL。
 * 後續若有新查詢樣式，再在 parse/handler 補分支即可。
 */
type Row = Record<string, any>;

type Tables = {
  species: Map<string, Row>;
  pets: Map<string, Row>;
  care_logs: Map<string, Row>;
};

function ensureTables(tables: Partial<Tables>) {
  if (!tables.species) tables.species = new Map();
  if (!tables.pets) tables.pets = new Map();
  if (!tables.care_logs) tables.care_logs = new Map();
  return tables as Tables;
}

function likeMatch(haystack: string, likePattern: string) {
  // 將 SQL 的 %xxx% 轉成簡易 contains
  const p = likePattern.replace(/^%|%$/g, '');
  return haystack.includes(p);
}

export function createTestDB(): SQLiteDatabase {
  const tables = ensureTables({});

  /** 允許多語句，僅處理 CREATE TABLE 與 PRAGMA，其他忽略 */
  async function execAsync(sql?: string) {
    if (!sql) return;
    const stmts = sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const s of stmts) {
      const upper = s.toUpperCase();
      if (upper.startsWith('PRAGMA')) {
        // 忽略 PRAGMA（對記憶體 DB 無作用）
        continue;
      }
      if (upper.startsWith('CREATE TABLE IF NOT EXISTS')) {
        // 很粗略地從語句推表名
        // e.g. CREATE TABLE IF NOT EXISTS pets ( ...
        const m = s.match(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_]+)/i);
        const table = m?.[1];
        if (!table) continue;
        if (table === 'species' && !tables.species) tables.species = new Map();
        if (table === 'pets' && !tables.pets) tables.pets = new Map();
        if (table === 'care_logs' && !tables.care_logs) tables.care_logs = new Map();
      }
    }
  }

  /** 僅支援本專案測試會用到的 INSERT/UPDATE/DELETE */
  async function runAsync(sql: string, params: any[] = []): Promise<SQLiteRunResult> {
    const up = sql.trim().toUpperCase();

    // INSERT INTO species (...)
    if (up.startsWith('INSERT INTO SPECIES')) {
      // VALUES (?, ?, ?, ?, ?, ?)
      const [key, common_name, scientific_name, notes, created_at, updated_at] = params;
      const existed = tables.species.has(key);
      tables.species.set(key, { key, common_name, scientific_name, notes, created_at, updated_at });
      return { changes: existed ? 0 : 1, lastInsertRowId: undefined };
    }

    // INSERT OR IGNORE INTO species (...)
    if (up.startsWith('INSERT OR IGNORE INTO SPECIES')) {
      const [key, common_name, scientific_name, notes, created_at, updated_at] = params;
      if (!tables.species.has(key)) {
        tables.species.set(key, { key, common_name, scientific_name, notes, created_at, updated_at });
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    // INSERT INTO pets (...)
    if (up.startsWith('INSERT INTO PETS')) {
      // columns: id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at
      const [
        id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at
      ] = params;

      // 模擬 FK species_key
      if (!tables.species.has(species_key)) {
        throw new Error('FOREIGN KEY constraint failed: pets.species_key → species.key');
      }
      // 模擬 CHECK(habitat IN ...)
      const allowed = ['indoor_uvb', 'outdoor_sun', 'mixed'];
      if (!allowed.includes(habitat)) {
        throw new Error('CHECK constraint failed: invalid habitat');
      }
      const existed = tables.pets.has(id);
      tables.pets.set(id, {
        id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at
      });
      return { changes: existed ? 0 : 1 };
    }

    // UPDATE pets SET ... WHERE id = ?
    if (up.startsWith('UPDATE PETS SET')) {
      const id = params[params.length - 1];
      const row = tables.pets.get(id);
      if (!row) return { changes: 0 };

      // 解析簡單的 "col = ?, col2 = ?" 清單
      const setPart = sql.replace(/^[\s\S]*?SET\s+/i, '').replace(/\s+WHERE[\s\S]*$/i, '');
      const cols = setPart.split(',').map(s => s.trim().split('=')[0].trim());
      const vals = params.slice(0, cols.length);
      const patch: Record<string, any> = {};
      cols.forEach((c, i) => (patch[c] = vals[i]));

      // 驗證 habitat（若有）
      if (patch.habitat !== undefined) {
        const allowed = ['indoor_uvb', 'outdoor_sun', 'mixed'];
        if (!allowed.includes(patch.habitat)) {
          throw new Error('CHECK constraint failed: invalid habitat');
        }
      }
      // 驗證 species_key（若有）
      if (patch.species_key !== undefined && !tables.species.has(patch.species_key)) {
        throw new Error('FOREIGN KEY constraint failed: pets.species_key → species.key');
      }

      const newRow = { ...row, ...patch };
      tables.pets.set(id, newRow);
      return { changes: 1 };
    }

    // DELETE FROM pets WHERE id = ?
    if (up.startsWith('DELETE FROM PETS WHERE')) {
      const [id] = params;
      const existed = tables.pets.delete(id);
      // 模擬 ON DELETE CASCADE：care_logs.pet_id = id 也刪掉
      for (const [key, v] of Array.from(tables.care_logs.entries())) {
        if (v.pet_id === id) tables.care_logs.delete(key);
      }
      return { changes: existed ? 1 : 0 };
    }

    // INSERT INTO care_logs (...)
    if (up.startsWith('INSERT INTO CARE_LOGS')) {
      const [id, pet_id, type, value, note, at, created_at, updated_at] = params;
      if (!tables.pets.has(pet_id)) {
        throw new Error('FOREIGN KEY constraint failed: care_logs.pet_id → pets.id');
      }
      const allowedType = ['feed','calcium','uvb_on','uvb_off','clean','weigh'];
      if (!allowedType.includes(type)) {
        throw new Error('CHECK constraint failed: invalid care_logs.type');
      }
      const existed = tables.care_logs.has(id);
      tables.care_logs.set(id, { id, pet_id, type, value, note, at, created_at, updated_at });
      return { changes: existed ? 0 : 1 };
    }

    // 其他語句（本測試不會用到）
    return { changes: 0 };
  }

  /** 僅支援目前測試會用到的 SELECT */
  async function getAllAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const up = sql.trim().toUpperCase();

    // SELECT * FROM pets WHERE id = ?
    if (/SELECT\s+\*\s+FROM\s+PETS\s+WHERE\s+ID\s*=\s*\?/i.test(sql)) {
      const [id] = params;
      const row = tables.pets.get(String(id));
      return row ? [row as T] : [];
    }

    // SELECT * FROM pets ...（支援 species_key / habitat / name LIKE）
    if (up.startsWith('SELECT * FROM PETS')) {
      // 解析 where 條件（非常簡化）
      let rows = Array.from(tables.pets.values());

      // species_key = ?
      const hasSpecies = /SPECIES_KEY\s*=\s*\?/i.test(sql);
      // habitat = ?
      const hasHabitat = /HABITAT\s*=\s*\?/i.test(sql);
      // name LIKE ?
      const hasNameLike = /NAME\s+LIKE\s+\?/i.test(sql);

      let pIndex = 0;
      if (hasSpecies) {
        const val = params[pIndex++]; rows = rows.filter(r => r.species_key === val);
      }
      if (hasHabitat) {
        const val = params[pIndex++]; rows = rows.filter(r => r.habitat === val);
      }
      if (hasNameLike) {
        const val = params[pIndex++]; rows = rows.filter(r => likeMatch(r.name ?? '', String(val)));
      }

      // ORDER BY updated_at DESC
      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));

      // LIMIT ? OFFSET ?
      const limit = Number(params[pIndex++]);
      const offset = Number(params[pIndex++] ?? 0);
      const sliced = rows.slice(offset, offset + limit);

      return sliced as T[];
    }

    // SELECT name FROM migrations ...（若有其他地方意外查詢 migrations，給空即可）
    if (up.startsWith('SELECT NAME FROM MIGRATIONS')) {
      return [] as T[];
    }

    return [] as T[];
  }

  async function withTransactionAsync(fn: () => Promise<void>) {
    // 單執行緒記憶體 DB，直接執行即可
    await fn();
  }

  return { execAsync, runAsync, getAllAsync, withTransactionAsync };
}
