// store.ts
import { configureStore } from '@reduxjs/toolkit';
import pets from './slices/petsSlice'; // ???πÂ???pets Â∞çÊ? key
import logs from './slices/logsSlice';
import alerts from './slices/alertsSlice';
import points from './slices/pointsSlice';
import products from './slices/productsSlice';
import uvb from './slices/uvbSlice';

export const store = configureStore({
  reducer: { pets, logs, alerts, points, products, uvb }, // ??key ?æÂú®??pets
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

