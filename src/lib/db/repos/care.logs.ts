// src/lib/db/repos/care.logs.ts
import { query, execute, type SQLParams } from '../db.client';
import { genId, nowIso, buildSetClause } from './_helpers';

// 與 schema 對齊
export type CareLogType =
  | 'feed'
  | 'calcium'
  | 'vitamin'
  | 'uvb_on'
  | 'uvb_off'
  | 'heat_on'
  | 'heat_off'
  | 'clean'
  | 'weigh';

export type CareLogSubtype =
  | 'calcium_plain'
  | 'calcium_d3'
  | 'vitamin_multi'
  | 'feed_greens'
  | 'feed_insect'
  | 'feed_meat'
  | 'feed_fruit'
  | 'uvb'
  | 'basking_heat'
  | 'heat_mat'
  | 'insect_dusting';

export type CareLogRow = {
  id: string;
  pet_id: string;
  type: CareLogType;
  subtype: CareLogSubtype | null; // ★ 新增
  category: string | null;        // ★ 新增（彙整分類用：'supplement','feed_insect',...）
  value: number | null;           // grams / kg / ...
  unit: string | null;            // ★ 新增：'g','kg','pcs','min','h'...
  note: string | null;
  at: string;                     // ISO datetime
  created_at: string;
  updated_at: string;
};

// ========= CRUD =========

/** 新增 care_log；自動填 id / created_at / updated_at */
export async function insertCareLog(
  data: Omit<CareLogRow, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  const sql = `
    INSERT INTO care_logs (id, pet_id, type, subtype, category, value, unit, note, at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const id = genId('log');
  const now = nowIso();
  const params: SQLParams = [
    id,
    data.pet_id,
    data.type,
    data.subtype ?? null,
    data.category ?? null,
    data.value ?? null,
    data.unit ?? null,
    data.note ?? null,
    data.at,
    now,
    now,
  ];
  await execute(sql, params);
  return id;
}

/** 局部更新；自動補 updated_at */
export async function updateCareLog(
  id: string,
  patch: Partial<Omit<CareLogRow, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  const { sql, params } = buildSetClause({
    ...patch,
    updated_at: nowIso(),
  });
  await execute(`UPDATE care_logs SET ${sql} WHERE id = ?`, [...params, id]);
}

export async function deleteCareLog(id: string): Promise<void> {
  await execute(`DELETE FROM care_logs WHERE id = ?`, [id]);
}

export async function getCareLogById(id: string): Promise<CareLogRow | null> {
  const rows = await query<CareLogRow>(`SELECT * FROM care_logs WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

// ========= 常用查詢 =========
export async function listCareLogsByPetBetween(
  petId: string,
  startISOInclusive: string,
  endISOExclusive: string,
  types?: CareLogType[]
): Promise<CareLogRow[]> {
  let sql = `
    SELECT * FROM care_logs
    WHERE pet_id = ?
      AND at >= ?
      AND at <  ?
  `;
  const params: SQLParams = [petId, startISOInclusive, endISOExclusive];

  if (types && types.length > 0) {
    sql += ` AND type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }

  sql += ` ORDER BY at ASC`;
  return query<CareLogRow>(sql, params);
}

/** 找到某日結束前最近一次體重紀錄（type='weigh'） */
export async function getLatestWeighOnOrBefore(
  petId: string,
  untilISOExclusive: string
): Promise<CareLogRow | null> {
  const rows = await query<CareLogRow>(
    `
    SELECT * FROM care_logs
    WHERE pet_id = ?
      AND type = 'weigh'
      AND at <  ?
    ORDER BY at DESC
    LIMIT 1
    `,
    [petId, untilISOExclusive]
  );
  return rows[0] ?? null;
}

// ========= 當日彙總（單一 SQL 版） =========

export type DailyAggregates = {
  feed_grams: number;           // 當日餵食總克數
  calcium_count: number;        // 當日補鈣（不分 D3）
  calcium_plain_count: number;  // ★ 當日純鈣次數
  calcium_d3_count: number;     // ★ 當日含 D3 次數
  vitamin_count: number;        // ★ 當日維他命次數
  uvb_hours: number;            // 當日 UVB 時數（on/off 配對）
  heat_hours: number;           // ★ 當日加熱時數（on/off 配對）
  weight_kg: number;            // 當日結束前最近一次體重
};

/**
 * 以單一 SQL 回傳多個欄位：
 * feed_grams / calcium_count / calcium_plain_count / calcium_d3_count / vitamin_count
 * uvb_hours / heat_hours / weight_kg
 *
 * 參數：
 * - petId：指定寵物
 * - dayStartISO：該日 00:00:00（含）
 * - dayEndISO：次日 00:00:00（不含）
 */
export async function getDailyAggregatesSQL(
  petId: string,
  dayStartISO: string,
  dayEndISO: string
): Promise<DailyAggregates> {
  const sql = `
  WITH day_logs AS (
    SELECT *
    FROM care_logs
    WHERE pet_id = ?
      AND at >= ?
      AND at <  ?
  ),
  feed AS (
    SELECT COALESCE(SUM(value), 0) AS feed_grams
    FROM day_logs
    WHERE type = 'feed'
  ),
  calcium AS (
    SELECT COUNT(*) AS calcium_count
    FROM day_logs
    WHERE type = 'calcium'
  ),
  calcium_plain AS (
    SELECT COUNT(*) AS calcium_plain_count
    FROM day_logs
    WHERE type = 'calcium' AND subtype = 'calcium_plain'
  ),
  calcium_d3 AS (
    SELECT COUNT(*) AS calcium_d3_count
    FROM day_logs
    WHERE type = 'calcium' AND subtype = 'calcium_d3'
  ),
  vitamin AS (
    SELECT COUNT(*) AS vitamin_count
    FROM day_logs
    WHERE type = 'vitamin'
  ),
  uvb_pairs AS (
    SELECT
      at,
      type,
      LAG(type) OVER (ORDER BY at) AS prev_type,
      LAG(at)   OVER (ORDER BY at) AS prev_at
    FROM day_logs
    WHERE type IN ('uvb_on','uvb_off')
  ),
  uvb AS (
    -- 僅計算「off 且前一筆是 on」的配對區段；未配對 on 尾段不計入
    SELECT COALESCE(SUM((julianday(at) - julianday(prev_at)) * 24.0), 0.0) AS uvb_hours
    FROM uvb_pairs
    WHERE type = 'uvb_off' AND prev_type = 'uvb_on'
  ),
  heat_pairs AS (
    SELECT
      at,
      type,
      LAG(type) OVER (ORDER BY at) AS prev_type,
      LAG(at)   OVER (ORDER BY at) AS prev_at
    FROM day_logs
    WHERE type IN ('heat_on','heat_off')
  ),
  heat AS (
    SELECT COALESCE(SUM((julianday(at) - julianday(prev_at)) * 24.0), 0.0) AS heat_hours
    FROM heat_pairs
    WHERE type = 'heat_off' AND prev_type = 'heat_on'
  ),
  weigh AS (
    SELECT value AS weight_kg
    FROM care_logs
    WHERE pet_id = ?
      AND type = 'weigh'
      AND at <  ?
    ORDER BY at DESC
    LIMIT 1
  )
  SELECT
    (SELECT feed_grams              FROM feed)            AS feed_grams,
    (SELECT calcium_count           FROM calcium)         AS calcium_count,
    (SELECT calcium_plain_count     FROM calcium_plain)   AS calcium_plain_count,
    (SELECT calcium_d3_count        FROM calcium_d3)      AS calcium_d3_count,
    (SELECT vitamin_count           FROM vitamin)         AS vitamin_count,
    (SELECT uvb_hours               FROM uvb)             AS uvb_hours,
    (SELECT heat_hours              FROM heat)            AS heat_hours,
    COALESCE((SELECT weight_kg FROM weigh), 0.0)          AS weight_kg;
  `;

  const rows = await query<DailyAggregates>(sql, [
    petId,
    dayStartISO,
    dayEndISO,
    petId,
    dayEndISO,
  ]);

  return rows[0] ?? {
    feed_grams: 0,
    calcium_count: 0,
    calcium_plain_count: 0,
    calcium_d3_count: 0,
    vitamin_count: 0,
    uvb_hours: 0,
    heat_hours: 0,
    weight_kg: 0,
  };
}

/** （範例）統計一段期間內的補充品分布，可用來對照 species_targets 的規則 */
export async function getSupplementCounts(
  petId: string,
  fromISO: string,
  toISO: string
): Promise<{ subtype: string; count: number }[]> {
  return query<{ subtype: string; count: number }>(`
    SELECT subtype, COUNT(*) as count
    FROM care_logs
    WHERE pet_id = ? AND at >= ? AND at < ? AND (type = 'calcium' OR type = 'vitamin')
    GROUP BY subtype
  `, [petId, fromISO, toISO]);
}
