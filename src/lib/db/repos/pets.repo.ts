// src/lib/db/repos/pets.repo.ts
import { execute, query, transaction } from "../db.client"
import { buildSetClause, genId, nowIso } from "./_helpers"

/** 與資料表一致的列型別 */
export type Habitat = "indoor_uvb" | "outdoor_sun" | "mixed"

export type PetRow = {
  id: string
  name: string
  species_key: string
  birth_date: string | null
  location_city: string | null
  habitat: Habitat
  avatar_uri: string | null
  created_at: string
  updated_at: string
}

// 🔹 JOIN 結果型別：多了一個 species_name（來自 species.common_name）
export type PetWithSpeciesRow = PetRow & {
  species_name: string | null // 可能為 null（LEFT JOIN）
}

export type PetInsert = {
  id?: string
  name: string
  species_key: string
  habitat: Habitat
  birth_date?: string | null
  location_city?: string | null
  avatar_uri?: string | null
}

export type PetUpdate = Partial<
  Pick<
    PetRow,
    | "name"
    | "species_key"
    | "birth_date"
    | "location_city"
    | "habitat"
    | "avatar_uri"
  >
>

export type PetFilter = {
  species_key?: string
  habitat?: Habitat
  nameLike?: string
  limit?: number
  offset?: number
}

const HABITATS: Habitat[] = ["indoor_uvb", "outdoor_sun", "mixed"]
function assertHabitat(h: string): asserts h is Habitat {
  if (!HABITATS.includes(h as Habitat)) {
    throw new Error(`Invalid habitat: ${h}`)
  }
}

/** 既有：新增 */
export async function insertPet(input: PetInsert): Promise<PetRow> {
  assertHabitat(input.habitat)
  const id = input.id ?? genId("pet")
  const created = nowIso()
  const updated = created

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
    ],
  )

  const rows = await query<PetRow>(`SELECT * FROM pets WHERE id = ?`, [id])
  return rows[0]!
}

/** 既有：讀取單筆（不含 species_name） */
export async function getPetById(id: string): Promise<PetRow | null> {
  const rows = await query<PetRow>(`SELECT * FROM pets WHERE id = ?`, [id])
  return rows[0] ?? null
}

/** 既有：清單（不含 species_name） */
export async function listPets(filter: PetFilter = {}): Promise<PetRow[]> {
  const where: string[] = []
  const params: any[] = []

  if (filter.species_key) {
    where.push(`p.species_key = ?`)
    params.push(filter.species_key)
  }
  if (filter.habitat) {
    assertHabitat(filter.habitat)
    where.push(`p.habitat = ?`)
    params.push(filter.habitat)
  }
  if (filter.nameLike) {
    where.push(`p.name LIKE ?`)
    params.push(`%${filter.nameLike}%`)
  }

  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0

  const sql = `
    SELECT p.*
    FROM pets p
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  return query<PetRow>(sql, params)
}

/** 既有：更新 */
export async function updatePet(id: string, patch: PetUpdate): Promise<PetRow> {
  if (patch.habitat) assertHabitat(patch.habitat)
  const toUpdate = { ...patch, updated_at: nowIso() }
  const { sql, params } = buildSetClause(toUpdate)
  await execute(`UPDATE pets SET ${sql} WHERE id = ?`, [...params, id])
  const row = await getPetById(id)
  if (!row) throw new Error(`Pet not found after update: ${id}`)
  return row
}

/** 既有：刪除 */
export async function deletePet(id: string): Promise<boolean> {
  const res = await execute(`DELETE FROM pets WHERE id = ?`, [id])
  return res.changes > 0
}

/** 既有示範：交易建立（略） */
export async function createPetWithInitialLog(/* ...同你原本程式 ... */) {
  // 保留你原本的實作
}

/* ---------------------------
 * 🔹 新增：JOIN 版查詢接口
 * --------------------------- */

/** 讀取單筆（含 species_name） */
export async function getPetWithSpeciesById(
  id: string,
): Promise<PetWithSpeciesRow | null> {
  const sql = `
    SELECT
      p.id, p.name, p.species_key, p.birth_date, p.location_city, p.habitat,
      p.avatar_uri, p.created_at, p.updated_at,
      s.common_name AS species_name
    FROM pets p
    LEFT JOIN species s ON s.key = p.species_key
    WHERE p.id = ?
    LIMIT 1
  `
  const rows = await query<PetWithSpeciesRow>(sql, [id])
  return rows[0] ?? null
}

/** 清單（含 species_name），過濾條件與原本一致 */
export async function listPetsWithSpecies(
  filter: PetFilter = {},
): Promise<PetWithSpeciesRow[]> {
  const where: string[] = []
  const params: any[] = []

  if (filter.species_key) {
    where.push(`p.species_key = ?`)
    params.push(filter.species_key)
  }
  if (filter.habitat) {
    assertHabitat(filter.habitat)
    where.push(`p.habitat = ?`)
    params.push(filter.habitat)
  }
  if (filter.nameLike) {
    where.push(`p.name LIKE ?`)
    params.push(`%${filter.nameLike}%`)
  }

  const limit = filter.limit ?? 50
  const offset = filter.offset ?? 0

  const sql = `
    SELECT
      p.id, p.name, p.species_key, p.birth_date, p.location_city, p.habitat,
      p.avatar_uri, p.created_at, p.updated_at,
      s.common_name AS species_name
    FROM pets p
    LEFT JOIN species s ON s.key = p.species_key
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.updated_at DESC
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  return query<PetWithSpeciesRow>(sql, params)
}

/** æ•¸é‡ */
export async function countPets(): Promise<number> {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM pets`,
    [],
  )
  return rows[0]?.count ?? 0
}
