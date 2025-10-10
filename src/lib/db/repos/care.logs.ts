// src/lib/db/repos/care.logs.ts
import { query, execute, type SQLParams } from '../db.client';
import { genId, nowIso, buildSetClause } from './_helpers';

// 與 schema 對齊
export type CareLogType =
  | 'feed'
  | 'calcium'
  | 'uvb_on'
  | 'uvb_off'
  | 'clean'
  | 'weigh';

export type CareLogRow = {
  id: string;
  pet_id: string;
  type: CareLogType;
  value: number | null;   // grams / kg / ...
  note: string | null;
  at: string;             // ISO datetime
  created_at: string;
  updated_at: string;
};

// ========= CRUD =========

/** 新增 care_log；自動填 id / created_at / updated_at */
export async function insertCareLog(data: Omit<CareLogRow, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const sql = `
    INSERT INTO care_logs (id, pet_id, type, value, note, at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const id = genId('log');
  const now = nowIso();
  const params: SQLParams = [
    id,
    data.pet_id,
    data.type,
    data.value ?? null,
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
  feed_grams: number;     // 當日餵食總克數
  calcium_count: number;  // 當日補鈣次數
  uvb_hours: number;      // 當日 UVB 時數（on/off 配對）
  weight_kg: number;      // 當日結束前最近一次體重
};

/**
 * 以單一 SQL 回傳四個欄位：
 * feed_grams / calcium_count / uvb_hours / weight_kg
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
    (SELECT feed_grams     FROM feed)     AS feed_grams,
    (SELECT calcium_count  FROM calcium)  AS calcium_count,
    (SELECT uvb_hours      FROM uvb)      AS uvb_hours,
    COALESCE((SELECT weight_kg FROM weigh), 0.0) AS weight_kg;
  `;

  const rows = await query<DailyAggregates>(sql, [
    petId,
    dayStartISO,
    dayEndISO,
    petId,
    dayEndISO,
  ]);

  return rows[0] ?? { feed_grams: 0, calcium_count: 0, uvb_hours: 0, weight_kg: 0 };
}
