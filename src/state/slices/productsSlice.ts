import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { query } from '../../lib/db/db.client';

export type Product = { id: string; name: string; brand: string | null; tags: string | null; affiliate_url: string | null; region: string | null; };

export const searchProductsByTags = createAsyncThunk('products/searchByTags', async (tags: string[]) => {
  // tags 為 JSON 陣列字串包含關鍵字（用 LIKE 簡易實作）
  const ors = tags.map(_ => `tags LIKE ?`).join(' OR ');
  const params = tags.map(t => `%${t}%`);
  return query<Product>(`SELECT * FROM products ${tags.length ? `WHERE ${ors}` : ''} ORDER BY updated_at DESC LIMIT 50`, params);
});

type State = { items: Product[]; loading: boolean };
const initial: State = { items: [], loading: false };

const productsSlice = createSlice({
  name: 'products',
  initialState: initial,
  reducers: {},
  extraReducers: b => {
    b.addCase(searchProductsByTags.pending, s => { s.loading = true; });
    b.addCase(searchProductsByTags.fulfilled, (s, a: PayloadAction<Product[]>) => { s.items = a.payload; s.loading = false; });
  }
});
export default productsSlice.reducer;
