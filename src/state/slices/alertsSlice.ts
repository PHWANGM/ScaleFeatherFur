import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { query, execute } from '../../lib/db/db.client';

export type AlertRow = {
  id: string;
  pet_id: string;
  at: string;
  severity: 'info' | 'warn' | 'critical';
  code: string;
  title: string;
  body: string;
  recommended_product_ids: string | null;
  created_at: string;
  updated_at: string;
};

// 以 petId 載入 alerts（明確標註返回型別與參數型別）
export const loadAlerts = createAsyncThunk<AlertRow[], string>(
  'alerts/load',
  async (petId) => {
    return query<AlertRow>(
      `SELECT * FROM alerts WHERE pet_id=? ORDER BY at DESC LIMIT 50`,
      [petId]
    );
  }
);

export const dismissAlert = createAsyncThunk<string, string>(
  'alerts/dismiss',
  async (id) => {
    await execute(`DELETE FROM alerts WHERE id=?`, [id]);
    return id;
  }
);

type State = { byPet: Record<string, AlertRow[]>; loading: boolean };
const initialState: State = { byPet: {}, loading: false };

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(loadAlerts.pending, (s) => {
      s.loading = true;
    });
    // 讓 RTK 自動推斷 action 型別 → 可用 a.meta.arg
    builder.addCase(loadAlerts.fulfilled, (s, a) => {
      const petId = a.meta.arg;
      s.byPet[petId] = a.payload;
      s.loading = false;
    });
    builder.addCase(loadAlerts.rejected, (s) => {
      s.loading = false;
    });

    builder.addCase(dismissAlert.fulfilled, (s, a) => {
      const id = a.payload;
      for (const k of Object.keys(s.byPet)) {
        s.byPet[k] = (s.byPet[k] ?? []).filter((x) => x.id !== id);
      }
    });
  },
});

export default alertsSlice.reducer;
