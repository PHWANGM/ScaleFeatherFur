// store.ts
import { configureStore } from '@reduxjs/toolkit';
import pets from './slices/petsSlice'; // ← 改名為 pets 對應 key
import logs from './slices/logsSlice';
import alerts from './slices/alertsSlice';
import points from './slices/pointsSlice';
import products from './slices/productsSlice';

export const store = configureStore({
  reducer: { pets, logs, alerts, points, products }, // ← key 現在是 pets
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
