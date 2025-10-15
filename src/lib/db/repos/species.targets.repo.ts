// src/lib/db/repos/species.targets.repo.ts
import { query, execute, type SQLParams } from '../db.client';
import { nowIso } from './_helpers';
import type { SpeciesRow } from './species.repo'; // ← 使用你已有的型別

export type LifeStage = 'juvenile' | 'adult';

export type SpeciesTargetRowRaw = {
  id: string;
  species_key: string;
  life_stage: LifeStage;
  uvb_spec: string | null;
  photoperiod_hours_min: number | null;
  photoperiod_hours_max: number | null;
  temp_ranges_json: string;            // JSON in DB
  diet_split_json: string | null;      // JSON in DB
  supplement_rules_json: string | null;// JSON in DB
  extra_json: string | null;           // JSON in DB
  created_at: string;
  updated_at: string;
};

export type TempRanges = {
  basking?: [number, number];
  hot?: [number, number];
  cool?: [number, number];
  ambient_day?: [number, number];
  ambient_night?: [number, number];
  [k: string]: [number, number] | undefined;
};

export type DietSplit = {
  greens?: number;
  insect?: number;
  meat?: number;
  fruit?: number;
  [k: string]: number | undefined;
};

export type SupplementRules = {
  [supplementSubtype: string]: string;
};

export type SpeciesTarget = {
  id: string;
  species_key: string;
  life_stage: LifeStage;
  uvb_spec?: string | null;
  photoperiod_hours_min?: number | null;
  photoperiod_hours_max?: number | null;
  temp_ranges: TempRanges;
  diet_split?: DietSplit | null;
  supplement_rules?: SupplementRules | null;
  extra?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function parseTargetRow(r: SpeciesTargetRowRaw): SpeciesTarget {
  const temp_ranges = safeParse<TempRanges>(r.temp_ranges_json, {});
  const diet_split = safeParse<DietSplit | null>(r.diet_split_json, null);
  const supplement_rules = safeParse<SupplementRules | null>(r.supplement_rules_json, null);
  const extra = safeParse<Record<string, unknown> | null>(r.extra_json, null);

  const normalizeRange = (x: any): [number, number] | undefined =>
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
    uvb_spec: r.uvb_spec,
    photoperiod_hours_min: r.photoperiod_hours_min,
    photoperiod_hours_max: r.photoperiod_hours_max,
    temp_ranges,
    diet_split,
    supplement_rules,
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

  const alt: LifeStage = desired === 'juvenile' ? 'adult' : ('juvenile' as LifeStage);
  return getTarget(pet.species_key, alt);
}

/** === upsert === */
export type UpsertSpeciesTargetInput = {
  id: string;
  species_key: string;
  life_stage: LifeStage;
  uvb_spec?: string | null;
  photoperiod_hours_min?: number | null;
  photoperiod_hours_max?: number | null;
  temp_ranges: TempRanges;
  diet_split?: DietSplit | null;
  supplement_rules?: SupplementRules | null;
  extra?: Record<string, unknown> | null;
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
    input.uvb_spec ?? null,
    input.photoperiod_hours_min ?? null,
    input.photoperiod_hours_max ?? null,
    JSON.stringify(input.temp_ranges ?? {}),
    input.diet_split ? JSON.stringify(input.diet_split) : null,
    input.supplement_rules ? JSON.stringify(input.supplement_rules) : null,
    input.extra ? JSON.stringify(input.extra) : null,
  ];

  if (exists.length === 0) {
    await execute(
      `INSERT INTO species_targets
        (id, species_key, life_stage, uvb_spec, photoperiod_hours_min, photoperiod_hours_max,
         temp_ranges_json, diet_split_json, supplement_rules_json, extra_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, ...baseParams, now, now]
    );
  } else {
    await execute(
      `UPDATE species_targets
       SET species_key = ?, life_stage = ?, uvb_spec = ?,
           photoperiod_hours_min = ?, photoperiod_hours_max = ?,
           temp_ranges_json = ?, diet_split_json = ?, supplement_rules_json = ?, extra_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [...baseParams, now, input.id]
    );
  }
}

export async function deleteSpeciesTarget(id: string): Promise<void> {
  await execute(`DELETE FROM species_targets WHERE id = ?`, [id]);
}

/** 工具：把 diet_split 正規化到總和=1 */
export function normalizeDietSplit(diet?: DietSplit | null): DietSplit | null {
  if (!diet) return null;
  const items = Object.entries(diet).filter(([, v]) => typeof v === 'number' && v! > 0);
  const total = items.reduce((s, [, v]) => s + (v as number), 0);
  if (total <= 0) return null;
  const out: DietSplit = {};
  for (const [k, v] of items) out[k] = (v as number) / total;
  return out;
}
