// src/lib/db/repos/species.repo.ts
import { query, execute } from '../db.client';
import { nowIso } from './_helpers';

export type SpeciesRow = {
  key: string;
  common_name: string;
  scientific_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSpecies(): Promise<SpeciesRow[]> {
  const sql = `SELECT key, common_name, scientific_name, notes, created_at, updated_at
               FROM species ORDER BY updated_at DESC`;
  return query<SpeciesRow>(sql, []);
}

export async function getSpeciesByKey(key: string): Promise<SpeciesRow | null> {
  const rows = await query<SpeciesRow>(`SELECT * FROM species WHERE key = ? LIMIT 1`, [key]);
  return rows[0] ?? null;
}

export async function insertSpecies(input: {
  key: string;
  common_name: string;
  scientific_name?: string | null;
  notes?: string | null;
}): Promise<SpeciesRow> {
  const created = nowIso();
  const updated = created;
  await execute(
    `INSERT INTO species (key, common_name, scientific_name, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.key, input.common_name, input.scientific_name ?? null, input.notes ?? null, created, updated]
  );
  const rows = await query<SpeciesRow>(`SELECT * FROM species WHERE key = ?`, [input.key]);
  return rows[0]!;
}

export async function updateSpecies(key: string, patch: {
  common_name?: string;
  scientific_name?: string | null;
  notes?: string | null;
}): Promise<SpeciesRow> {
  const updated = nowIso();
  const fields: string[] = [];
  const params: any[] = [];
  if (patch.common_name !== undefined) { fields.push('common_name = ?'); params.push(patch.common_name); }
  if (patch.scientific_name !== undefined) { fields.push('scientific_name = ?'); params.push(patch.scientific_name); }
  if (patch.notes !== undefined) { fields.push('notes = ?'); params.push(patch.notes); }
  fields.push('updated_at = ?'); params.push(updated);
  await execute(`UPDATE species SET ${fields.join(', ')} WHERE key = ?`, [...params, key]);
  const rows = await query<SpeciesRow>(`SELECT * FROM species WHERE key = ?`, [key]);
  return rows[0]!;
}

export async function deleteSpecies(key: string): Promise<boolean> {
  const res = await execute(`DELETE FROM species WHERE key = ?`, [key]);
  return res.changes > 0;
}

// --- Debug only ---
export async function debugSpeciesSnapshot(): Promise<{
  tables: string[];
  speciesCount: number;
  sample: Pick<SpeciesRow, 'key' | 'common_name' | 'scientific_name' | 'updated_at'>[];
}> {
  const tables = await query<{ name: string }>(
    `SELECT name FROM sqlite_master 
     WHERE type='table' AND name IN ('species','migrations','species_targets');`
  );
  const countRows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM species;`);
  const sample = await query<Pick<SpeciesRow,'key'|'common_name'|'scientific_name'|'updated_at'>>(
    `SELECT key, common_name, scientific_name, updated_at 
     FROM species ORDER BY updated_at DESC LIMIT 3;`
  );

  return {
    tables: tables.map(t => t.name),
    speciesCount: countRows?.[0]?.n ?? 0,
    sample,
  };
}