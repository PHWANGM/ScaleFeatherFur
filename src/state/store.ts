import { configureStore } from '@reduxjs/toolkit';
import yPetState from './slices/petsSlice';
import logs from './slices/logsSlice';
import alerts from './slices/alertsSlice';
import points from './slices/pointsSlice';
import products from './slices/productsSlice';

export const store = configureStore({
  reducer: { yPetState, logs, alerts, points, products },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
