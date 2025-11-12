// src/lib/db/repos/species.targets.repo.ts
import { query, execute, type SQLParams } from '../db.client';
import { nowIso } from './_helpers';

export type LifeStage = 'juvenile' | 'adult';

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

  /* 現有 schema：以小時存 D3 週期 */
  vitamin_d3_interval_hours_min: number | null;
  vitamin_d3_interval_hours_max: number | null;

  temp_ranges_json: string | null;
  extra_json: string | null;

  created_at: string;
  updated_at: string;
};

export type TempRanges = {
  basking?: [number, number];
  hot?: [number, number];
  cool?: [number, number];
  ambient?: [number, number];
  ambient_day?: [number, number];
  ambient_night?: [number, number];
  [k: string]: [number, number] | undefined;
};

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

  feeding_interval_hours_min?: number | null;
  feeding_interval_hours_max?: number | null;

  diet_note?: string | null;

  /** 以「天」暴露給 App（DB 仍以小時存） */
  vitamin_d3_interval_days_min?: number | null;
  vitamin_d3_interval_days_max?: number | null;

  /** 每幾餐灑一次鈣粉（1=每餐） */
  calcium_every_meals?: number | null;

  /** 飲食百分比（0..100） */
  diet_veg_pct_min?: number | null;
  diet_veg_pct_max?: number | null;
  diet_meat_pct_min?: number | null;
  diet_meat_pct_max?: number | null;
  diet_fruit_pct_min?: number | null;
  diet_fruit_pct_max?: number | null;

  /** UVB 單位提示（目前皆為 'percent'） */
  uvb_unit?: string | null;

  temp_ranges: TempRanges;
  /** 原樣保留的 extra（含上述鍵） */
  extra?: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
};

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function cleanTempRanges(r: TempRanges): TempRanges {
  const out: TempRanges = {};
  const ok = (x: unknown): x is [number, number] =>
    Array.isArray(x) && x.length === 2 && x.every(n => typeof n === 'number' && isFinite(n)) && x[0] <= x[1];
  for (const [k, v] of Object.entries(r)) if (ok(v)) out[k] = v;
  return out;
}

function pickNumber(obj: any, path: string[]): number | null {
  try {
    let cur: any = obj;
    for (const k of path) cur = cur?.[k];
    return typeof cur === 'number' && isFinite(cur) ? cur : null;
  } catch { return null; }
}

function parseTargetRow(r: SpeciesTargetRowRaw): SpeciesTarget {
  const extra = safeParse<Record<string, unknown> | null>(r.extra_json, null);
  const temp_ranges = cleanTempRanges(safeParse<TempRanges>(r.temp_ranges_json, {}));

  // 以 extra_json 為主，沒有才用 hours 換算
  const d3_days_min =
    pickNumber(extra, ['vitamin_d3_interval_days','min']) ??
    (typeof r.vitamin_d3_interval_hours_min === 'number' ? Math.round(r.vitamin_d3_interval_hours_min / 24) : null);

  const d3_days_max =
    pickNumber(extra, ['vitamin_d3_interval_days','max']) ??
    (typeof r.vitamin_d3_interval_hours_max === 'number' ? Math.round(r.vitamin_d3_interval_hours_max / 24) : null);

  const diet_veg_min  = pickNumber(extra, ['diet_percentages','veg','min']);
  const diet_veg_max  = pickNumber(extra, ['diet_percentages','veg','max']);
  const diet_meat_min = pickNumber(extra, ['diet_percentages','meat','min']);
  const diet_meat_max = pickNumber(extra, ['diet_percentages','meat','max']);
  const diet_fruit_min= pickNumber(extra, ['diet_percentages','fruit','min']);
  const diet_fruit_max= pickNumber(extra, ['diet_percentages','fruit','max']);

  const calcium_every_meals = pickNumber(extra, ['calcium_every_meals']);
  const uvb_unit = (extra?.['uvb_unit'] as string) ?? 'percent';

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

    vitamin_d3_interval_days_min: d3_days_min,
    vitamin_d3_interval_days_max: d3_days_max,

    calcium_every_meals,
    diet_veg_pct_min: diet_veg_min,
    diet_veg_pct_max: diet_veg_max,
    diet_meat_pct_min: diet_meat_min,
    diet_meat_pct_max: diet_meat_max,
    diet_fruit_pct_min: diet_fruit_min,
    diet_fruit_pct_max: diet_fruit_max,
    uvb_unit,

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

export async function getTarget(speciesKey: string, lifeStage: LifeStage): Promise<SpeciesTarget | null> {
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

/** === upsert：把新欄位都塞進 extra_json，D3(天) 轉小時寫回舊欄位 === */
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

  vitamin_d3_interval_days_min?: number | null;
  vitamin_d3_interval_days_max?: number | null;

  calcium_every_meals?: number | null;

  diet_veg_pct_min?: number | null;
  diet_veg_pct_max?: number | null;
  diet_meat_pct_min?: number | null;
  diet_meat_pct_max?: number | null;
  diet_fruit_pct_min?: number | null;
  diet_fruit_pct_max?: number | null;

  temp_ranges?: TempRanges;
  extra?: Record<string, unknown> | null;
  uvb_unit?: string | null;
};

function buildExtraFromInput(input: UpsertSpeciesTargetInput): Record<string, unknown> | null {
  const extra: Record<string, unknown> = { ...(input.extra ?? {}) };

  if (input.uvb_unit) extra['uvb_unit'] = input.uvb_unit;
  else if (extra['uvb_unit'] == null) extra['uvb_unit'] = 'percent';

  // 鈣粉每幾餐一次
  if (typeof input.calcium_every_meals === 'number') extra['calcium_every_meals'] = input.calcium_every_meals;

  // D3 以天
  if (input.vitamin_d3_interval_days_min != null || input.vitamin_d3_interval_days_max != null) {
    extra['vitamin_d3_interval_days'] = {
      min: input.vitamin_d3_interval_days_min ?? null,
      max: input.vitamin_d3_interval_days_max ?? null,
    };
  }

  // 飲食百分比
  const diet: any = {};
  if (input.diet_veg_pct_min != null || input.diet_veg_pct_max != null) {
    diet.veg = { min: input.diet_veg_pct_min ?? null, max: input.diet_veg_pct_max ?? null };
  }
  if (input.diet_meat_pct_min != null || input.diet_meat_pct_max != null) {
    diet.meat = { min: input.diet_meat_pct_min ?? null, max: input.diet_meat_pct_max ?? null };
  }
  if (input.diet_fruit_pct_min != null || input.diet_fruit_pct_max != null) {
    diet.fruit = { min: input.diet_fruit_pct_min ?? null, max: input.diet_fruit_pct_max ?? null };
  }
  if (Object.keys(diet).length > 0) extra['diet_percentages'] = diet;

  return Object.keys(extra).length > 0 ? extra : null;
}

export async function upsertSpeciesTarget(input: UpsertSpeciesTargetInput): Promise<void> {
  const now = nowIso();
  const exists = await query<{ id: string }>(
    `SELECT id FROM species_targets WHERE id = ? LIMIT 1`,
    [input.id]
  );

  // 以天 -> 以小時（存回 DB 舊欄位）
  const d3hMin = input.vitamin_d3_interval_days_min != null ? input.vitamin_d3_interval_days_min * 24 : null;
  const d3hMax = input.vitamin_d3_interval_days_max != null ? input.vitamin_d3_interval_days_max * 24 : null;

  const tempRangesJson = JSON.stringify(input.temp_ranges ?? {});
  const extraJson = buildExtraFromInput(input);

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

    d3hMin,
    d3hMax,

    tempRangesJson,
    extraJson ? JSON.stringify(extraJson) : null,
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
        (?,  ?, ?,  ?, ?, ?, ?,  ?, ?,  ?, ?,  ?, ?,  ?,  ?, ?,  ?, ?,  ?, ?)`,
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

export function sanitizeTempRanges(ranges?: TempRanges | null): TempRanges {
  if (!ranges) return {};
  return cleanTempRanges(ranges);
}
