// src/lib/db/repos/species.targets.repo.ts
import { query, execute, type SQLParams } from '../db.client';
import { nowIso } from './_helpers';
import type { SpeciesRow } from './species.repo'; // 如果沒用到也可移除

export type LifeStage = 'juvenile' | 'adult';

/** ==== DB raw row（對應 SQLite 欄位） ==== */
export type SpeciesTargetRowRaw = {
  id: string;
  species_key: string;
  life_stage: LifeStage;

  uvb_intensity_min: number | null;
  uvb_intensity_max: number | null;
  uvb_daily_hours_min: number | null;
  uvb_daily_hours_max: number | null;

  photoperiod_hours_min: number | null;
  photoperiod_hours_max: number | null;

  ambient_temp_c_min: number | null;
  ambient_temp_c_max: number | null;

  feeding_interval_hours_min: number | null;
  feeding_interval_hours_max: number | null;

  diet_note: string | null;

  vitamin_d3_interval_hours_min: number | null;
  vitamin_d3_interval_hours_max: number | null;

  temp_ranges_json: string | null;  // JSON in DB（可為 null）
  extra_json: string | null;        // JSON in DB（可為 null）

  created_at: string;
  updated_at: string;
};

/** 細分溫區（選用） */
export type TempRanges = {
  basking?: [number, number];
  hot?: [number, number];
  cool?: [number, number];
  ambient_day?: [number, number];
  ambient_night?: [number, number];
  [k: string]: [number, number] | undefined;
};

/** ==== Domain 型別（App 內部使用） ==== */
export type SpeciesTarget = {
  id: string;
  species_key: string;
  life_stage: LifeStage;

  uvb_intensity_min?: number | null;
  uvb_intensity_max?: number | null;
  uvb_daily_hours_min?: number | null;
  uvb_daily_hours_max?: number | null;

  photoperiod_hours_min?: number | null;
  photoperiod_hours_max?: number | null;

  ambient_temp_c_min?: number | null;
  ambient_temp_c_max?: number | null;

  /** 每 X～Y 小時餵一次（已依 life_stage 分開存） */
  feeding_interval_hours_min?: number | null;
  feeding_interval_hours_max?: number | null;

  diet_note?: string | null;

  /** D3 維他命補充間隔（小時） */
  vitamin_d3_interval_hours_min?: number | null;
  vitamin_d3_interval_hours_max?: number | null;

  temp_ranges: TempRanges;                 // 解析後物件（至少為 {}）
  extra?: Record<string, unknown> | null;  // 解析後物件或 null

  created_at: string;
  updated_at: string;
};

/** ==== helpers ==== */
function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function parseTargetRow(r: SpeciesTargetRowRaw): SpeciesTarget {
  const temp_ranges = safeParse<TempRanges>(r.temp_ranges_json ?? null, {});
  const extra = safeParse<Record<string, unknown> | null>(r.extra_json ?? null, null);

  const normalizeRange = (x: unknown): [number, number] | undefined =>
    Array.isArray(x) && x.length === 2 && x.every(n => typeof n === 'number')
      ? [x[0], x[1]]
      : undefined;

  for (const k of Object.keys(temp_ranges)) {
    const n = normalizeRange((temp_ranges as any)[k]);
    if (!n) delete (temp_ranges as any)[k];
    else (temp_ranges as any)[k] = n;
  }

  return {
    id: r.id,
    species_key: r.species_key,
    life_stage: r.life_stage,

    uvb_intensity_min: r.uvb_intensity_min,
    uvb_intensity_max: r.uvb_intensity_max,
    uvb_daily_hours_min: r.uvb_daily_hours_min,
    uvb_daily_hours_max: r.uvb_daily_hours_max,

    photoperiod_hours_min: r.photoperiod_hours_min,
    photoperiod_hours_max: r.photoperiod_hours_max,

    ambient_temp_c_min: r.ambient_temp_c_min,
    ambient_temp_c_max: r.ambient_temp_c_max,

    feeding_interval_hours_min: r.feeding_interval_hours_min,
    feeding_interval_hours_max: r.feeding_interval_hours_max,

    diet_note: r.diet_note,

    vitamin_d3_interval_hours_min: r.vitamin_d3_interval_hours_min,
    vitamin_d3_interval_hours_max: r.vitamin_d3_interval_hours_max,

    temp_ranges,
    extra,

    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** === 查詢 === */
export async function listTargetsBySpecies(speciesKey: string): Promise<SpeciesTarget[]> {
  const rows = await query<SpeciesTargetRowRaw>(
    `SELECT * FROM species_targets WHERE species_key = ? ORDER BY life_stage ASC`,
    [speciesKey]
  );
  return rows.map(parseTargetRow);
}

export async function getTarget(
  speciesKey: string,
  lifeStage: LifeStage
): Promise<SpeciesTarget | null> {
  const rows = await query<SpeciesTargetRowRaw>(
    `SELECT * FROM species_targets WHERE species_key = ? AND life_stage = ? LIMIT 1`,
    [speciesKey, lifeStage]
  );
  return rows[0] ? parseTargetRow(rows[0]) : null;
}

/** 依寵物取得對應 life_stage 的 target；若無則退回另一階段 */
export async function getEffectiveTargetForPet(petId: string): Promise<SpeciesTarget | null> {
  const petRows = await query<{ species_key: string; life_stage: LifeStage | null }>(
    `SELECT species_key, life_stage FROM pets WHERE id = ? LIMIT 1`,
    [petId]
  );
  const pet = petRows[0];
  if (!pet) return null;

  const desired: LifeStage = (pet.life_stage ?? 'adult') as LifeStage;
  const primary = await getTarget(pet.species_key, desired);
  if (primary) return primary;

  const alt: LifeStage = desired === 'juvenile' ? 'adult' : 'juvenile';
  return getTarget(pet.species_key, alt);
}

/** === upsert === */
export type UpsertSpeciesTargetInput = {
  id: string;
  species_key: string;
  life_stage: LifeStage;

  uvb_intensity_min?: number | null;
  uvb_intensity_max?: number | null;
  uvb_daily_hours_min?: number | null;
  uvb_daily_hours_max?: number | null;

  photoperiod_hours_min?: number | null;
  photoperiod_hours_max?: number | null;

  ambient_temp_c_min?: number | null;
  ambient_temp_c_max?: number | null;

  feeding_interval_hours_min?: number | null;
  feeding_interval_hours_max?: number | null;

  diet_note?: string | null;

  vitamin_d3_interval_hours_min?: number | null;
  vitamin_d3_interval_hours_max?: number | null;

  temp_ranges?: TempRanges;                 // 預設 {}
  extra?: Record<string, unknown> | null;   // 可放 {"uvb_unit":"percent"} 等
};

export async function upsertSpeciesTarget(input: UpsertSpeciesTargetInput): Promise<void> {
  const now = nowIso();
  const exists = await query<{ id: string }>(
    `SELECT id FROM species_targets WHERE id = ? LIMIT 1`,
    [input.id]
  );

  const baseParams: SQLParams = [
    input.species_key,
    input.life_stage,

    input.uvb_intensity_min ?? null,
    input.uvb_intensity_max ?? null,
    input.uvb_daily_hours_min ?? null,
    input.uvb_daily_hours_max ?? null,

    input.photoperiod_hours_min ?? null,
    input.photoperiod_hours_max ?? null,

    input.ambient_temp_c_min ?? null,
    input.ambient_temp_c_max ?? null,

    input.feeding_interval_hours_min ?? null,
    input.feeding_interval_hours_max ?? null,

    input.diet_note ?? null,

    input.vitamin_d3_interval_hours_min ?? null,
    input.vitamin_d3_interval_hours_max ?? null,

    JSON.stringify(input.temp_ranges ?? {}),
    input.extra ? JSON.stringify(input.extra) : null,
  ];

  if (exists.length === 0) {
    await execute(
      `INSERT INTO species_targets
        (id, species_key, life_stage,
         uvb_intensity_min, uvb_intensity_max, uvb_daily_hours_min, uvb_daily_hours_max,
         photoperiod_hours_min, photoperiod_hours_max,
         ambient_temp_c_min, ambient_temp_c_max,
         feeding_interval_hours_min, feeding_interval_hours_max,
         diet_note,
         vitamin_d3_interval_hours_min, vitamin_d3_interval_hours_max,
         temp_ranges_json, extra_json,
         created_at, updated_at)
       VALUES
        (?,  ?,           ?, 
         ?,  ?,  ?,  ?,
         ?,  ?,
         ?,  ?,
         ?,  ?,
         ?, 
         ?,  ?,
         ?,  ?,
         ?,  ?)`,
      [input.id, ...baseParams, now, now]
    );
  } else {
    await execute(
      `UPDATE species_targets
       SET species_key = ?, life_stage = ?,
           uvb_intensity_min = ?, uvb_intensity_max = ?, uvb_daily_hours_min = ?, uvb_daily_hours_max = ?,
           photoperiod_hours_min = ?, photoperiod_hours_max = ?,
           ambient_temp_c_min = ?, ambient_temp_c_max = ?,
           feeding_interval_hours_min = ?, feeding_interval_hours_max = ?,
           diet_note = ?,
           vitamin_d3_interval_hours_min = ?, vitamin_d3_interval_hours_max = ?,
           temp_ranges_json = ?, extra_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [...baseParams, now, input.id]
    );
  }
}

export async function deleteSpeciesTarget(id: string): Promise<void> {
  await execute(`DELETE FROM species_targets WHERE id = ?`, [id]);
}

/** 工具：將 temp_ranges 的各區間驗證成 [min,max] */
export function sanitizeTempRanges(ranges?: TempRanges | null): TempRanges {
  if (!ranges) return {};
  const out: TempRanges = {};
  const isPair = (x: unknown): x is [number, number] =>
    Array.isArray(x) && x.length === 2 && x.every(n => typeof n === 'number') && x[0] <= x[1];
  for (const [k, v] of Object.entries(ranges)) {
    if (isPair(v)) out[k] = v;
  }
  return out;
}
