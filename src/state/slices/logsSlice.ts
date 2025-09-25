import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { query, execute } from '../../lib/db/db.client';

export type CareLog = {
  id: string;
  pet_id: string;
  type: 'feed' | 'calcium' | 'uvb_on' | 'uvb_off' | 'clean' | 'weigh';
  value: number | null;
  note: string | null;
  at: string;
  created_at: string;
  updated_at: string;
};

// 依寵物與（可選）type 載入 logs（加上泛型以保留 meta.arg）
export const loadLogsByPet = createAsyncThunk<
  CareLog[],
  { petId: string; type?: CareLog['type'] }
>('logs/loadByPet', async ({ petId, type }) => {
  const where: string[] = ['pet_id = ?'];
  const params: any[] = [petId];
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  return query<CareLog>(
    `SELECT * FROM care_logs WHERE ${where.join(' AND ')} ORDER BY at DESC LIMIT 200`,
    params
  );
});

export const addCareLog = createAsyncThunk<
  CareLog,
  Omit<CareLog, 'id' | 'created_at' | 'updated_at'>
>('logs/add', async (l) => {
  const now = new Date().toISOString();
  const id = `log_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
  await execute(
    `INSERT INTO care_logs (id, pet_id, type, value, note, at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, l.pet_id, l.type, l.value ?? null, l.note ?? null, l.at, now, now]
  );
  const rows = await query<CareLog>(`SELECT * FROM care_logs WHERE id=?`, [id]);
  return rows[0]!;
});

type State = { byPet: Record<string, CareLog[]>; loading: boolean };
const initialState: State = { byPet: {}, loading: false };

const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(loadLogsByPet.pending, (s) => {
      s.loading = true;
    });
    // 不要手動註解 PayloadAction，讓 RTK 自動推斷 → 可用 a.meta.arg
    b.addCase(loadLogsByPet.fulfilled, (s, a) => {
      const { petId } = a.meta.arg;
      s.byPet[petId] = a.payload;
      s.loading = false;
    });
    b.addCase(loadLogsByPet.rejected, (s) => {
      s.loading = false;
    });

    b.addCase(addCareLog.fulfilled, (s, a) => {
      const petId = a.payload.pet_id;
      s.byPet[petId] = [a.payload, ...(s.byPet[petId] ?? [])];
    });
  },
});

export default logsSlice.reducer;
