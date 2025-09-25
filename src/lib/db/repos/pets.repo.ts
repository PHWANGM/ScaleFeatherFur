// src/lib/db/repos/pets.repo.ts
import { query, execute, transaction } from '../db.client';
import { buildSetClause, genId, nowIso } from './_helpers';

/** 與資料表一致的列型別 */
export type Habitat = 'indoor_uvb' | 'outdoor_sun' | 'mixed';

export type PetRow = {
  id: string;
  name: string;
  species_key: string;
  birth_date: string | null;
  location_city: string | null;
  habitat: Habitat;
  avatar_uri: string | null;
  created_at: string;
  updated_at: string;
};

export type PetInsert = {
  id?: string;                // 可自帶，未提供則自動產生
  name: string;
  species_key: string;
  habitat: Habitat;
  birth_date?: string | null;
  location_city?: string | null;
  avatar_uri?: string | null;
};

export type PetUpdate = Partial<Pick<
  PetRow,
  'name' | 'species_key' | 'birth_date' | 'location_city' | 'habitat' | 'avatar_uri'
>>;

export type PetFilter = {
  species_key?: string;
  habitat?: Habitat;
  nameLike?: string;          // 模糊查詢
  limit?: number;
  offset?: number;
};

const HABITATS: Habitat[] = ['indoor_uvb', 'outdoor_sun', 'mixed'];
function assertHabitat(h: string): asserts h is Habitat {
  if (!HABITATS.includes(h as Habitat)) {
    throw new Error(`Invalid habitat: ${h}`);
  }
}

/** 新增 */
export async function insertPet(input: PetInsert): Promise<PetRow> {
  assertHabitat(input.habitat);
  const id = input.id ?? genId('pet');
  const created = nowIso();
  const updated = created;

  await execute(
    `INSERT INTO pets
      (id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.species_key,
      input.birth_date ?? null,
      input.location_city ?? null,
      input.habitat,
      input.avatar_uri ?? null,
      created,
      updated,
    ]
  );

  const rows = await query<PetRow>(`SELECT * FROM pets WHERE id = ?`, [id]);
  return rows[0]!;
}

/** 讀取單筆 */
export async function getPetById(id: string): Promise<PetRow | null> {
  const rows = await query<PetRow>(`SELECT * FROM pets WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

/** 查詢清單（簡易篩選） */
export async function listPets(filter: PetFilter = {}): Promise<PetRow[]> {
  const where: string[] = [];
  const params: any[] = [];

  if (filter.species_key) {
    where.push(`species_key = ?`);
    params.push(filter.species_key);
  }
  if (filter.habitat) {
    assertHabitat(filter.habitat);
    where.push(`habitat = ?`);
    params.push(filter.habitat);
  }
  if (filter.nameLike) {
    where.push(`name LIKE ?`);
    params.push(`%${filter.nameLike}%`);
  }

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  const sql = `
    SELECT * FROM pets
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return query<PetRow>(sql, params);
}

/** 更新（部分欄位） */
export async function updatePet(id: string, patch: PetUpdate): Promise<PetRow> {
  if (patch.habitat) assertHabitat(patch.habitat);

  // 自動補 updated_at
  const toUpdate = { ...patch, updated_at: nowIso() };
  const { sql, params } = buildSetClause(toUpdate);

  await execute(`UPDATE pets SET ${sql} WHERE id = ?`, [...params, id]);

  const row = await getPetById(id);
  if (!row) throw new Error(`Pet not found after update: ${id}`);
  return row;
}

/** 刪除（硬刪） */
export async function deletePet(id: string): Promise<boolean> {
  const res = await execute(`DELETE FROM pets WHERE id = ?`, [id]);
  return res.changes > 0;
}

/** 交易範例：一次新增寵物與第一筆 care_log（僅示範，非必需） */
export async function createPetWithInitialLog(
  pet: PetInsert,
  firstLog?: { type: 'weigh' | 'feed' | 'calcium' | 'uvb_on' | 'uvb_off' | 'clean'; value?: number | null; note?: string | null; atIso?: string }
): Promise<PetRow> {
  let createdPet: PetRow | null = null;
  await transaction(async (tx) => {
    // 建寵物
    const id = pet.id ?? genId('pet');
    const created = nowIso();
    const updated = created;
    await tx.execute(
      `INSERT INTO pets (id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, pet.name, pet.species_key,
        pet.birth_date ?? null, pet.location_city ?? null, pet.habitat, pet.avatar_uri ?? null,
        created, updated,
      ]
    );

    // 選擇性新增第一筆 care_log
    if (firstLog) {
      const logId = genId('log');
      const now = nowIso();
      await tx.execute(
        `INSERT INTO care_logs (id, pet_id, type, value, note, at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId, id, firstLog.type, firstLog.value ?? null, firstLog.note ?? null,
          firstLog.atIso ?? now, now, now,
        ]
      );
    }

    const rows = await tx.query<PetRow>(`SELECT * FROM pets WHERE id = ?`, [id]);
    createdPet = rows[0]!;
  });
  return createdPet!;
}
