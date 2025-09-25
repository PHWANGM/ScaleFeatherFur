import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { query, execute } from '../../lib/db/db.client';

export type Ledger = { id: string; pet_id: string; at: string; reason: string; delta: number; balance_after: number; created_at: string; updated_at: string; };

export const addPointsForTask = createAsyncThunk('points/addForTask', async (p: { petId: string; taskKey: string; points: number }) => {
  // 取得最新餘額
  const last = await query<Pick<Ledger,'balance_after'>>(
    `SELECT balance_after FROM points_ledger WHERE pet_id=? ORDER BY at DESC LIMIT 1`,
    [p.petId]
  );
  const prev = last[0]?.balance_after ?? 0;
  const now = new Date().toISOString();
  const id = `pt_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
  const balance = prev + p.points;

  await execute(
    `INSERT INTO points_ledger (id, pet_id, at, reason, delta, balance_after, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, p.petId, now, `task_complete:${p.taskKey}`, p.points, balance, now, now]
  );
  const rows = await query<Ledger>(`SELECT * FROM points_ledger WHERE id=?`, [id]);
  return rows[0];
});

export const getBalance = createAsyncThunk('points/balance', async (petId: string) => {
  const rows = await query<Pick<Ledger,'balance_after'>>(
    `SELECT balance_after FROM points_ledger WHERE pet_id=? ORDER BY at DESC LIMIT 1`,
    [petId]
  );
  return { petId, balance: rows[0]?.balance_after ?? 0 };
});

type State = { byPet: Record<string, number>; };
const initial: State = { byPet: {} };

const slice = createSlice({
  name: 'points',
  initialState: initial,
  reducers: {},
  extraReducers: b => {
    b.addCase(addPointsForTask.fulfilled, (s, a) => {
      const { pet_id, balance_after } = a.payload;
      s.byPet[pet_id] = balance_after;
    });
    b.addCase(getBalance.fulfilled, (s, a) => {
      s.byPet[a.payload.petId] = a.payload.balance;
    });
  }
});
export default slice.reducer;
