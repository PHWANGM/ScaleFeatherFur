import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { query, execute } from '../../lib/db/db.client';

export type Pet = {
  id: string; name: string; species_key: string;
  birth_date: string | null; location_city: string | null;
  habitat: 'indoor_uvb' | 'outdoor_sun' | 'mixed';
  avatar_uri: string | null; created_at: string; updated_at: string;
};

export const loadPets = createAsyncThunk('pets/load', async () => {
  return query<Pet>(`SELECT * FROM pets ORDER BY updated_at DESC`);
});

export const upsertPet = createAsyncThunk('pets/upsert', async (p: Partial<Pet> & { name: string; species_key: string; habitat: Pet['habitat'] }) => {
  const now = new Date().toISOString();
  if (p.id) {
    await execute(
      `UPDATE pets SET name=?, species_key=?, birth_date=?, location_city=?, habitat=?, avatar_uri=?, updated_at=? WHERE id=?`,
      [p.name, p.species_key, p.birth_date ?? null, p.location_city ?? null, p.habitat, p.avatar_uri ?? null, now, p.id]
    );
    const rows = await query<Pet>(`SELECT * FROM pets WHERE id=?`, [p.id]);
    return rows[0];
  } else {
    const id = `pet_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    await execute(
      `INSERT INTO pets (id, name, species_key, birth_date, location_city, habitat, avatar_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, p.name, p.species_key, p.birth_date ?? null, p.location_city ?? null, p.habitat, p.avatar_uri ?? null, now, now]
    );
    const rows = await query<Pet>(`SELECT * FROM pets WHERE id=?`, [id]);
    return rows[0];
  }
});

type State = { items: Pet[]; loading: boolean };
const initial: State = { items: [], loading: false };

const petsSlice = createSlice({
  name: 'pets',
  initialState: initial,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(loadPets.pending, s => { s.loading = true; });
    builder.addCase(loadPets.fulfilled, (s, a: PayloadAction<Pet[]>) => { s.items = a.payload; s.loading = false; });
    builder.addCase(upsertPet.fulfilled, (s, a: PayloadAction<Pet>) => {
      const i = s.items.findIndex(x => x.id === a.payload.id);
      if (i >= 0) s.items[i] = a.payload; else s.items.unshift(a.payload);
    });
  }
});

export default petsSlice.reducer;
