// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import myPet from './myPetSlice';

export const store = configureStore({
  reducer: {
    myPet, // ← 一定要叫 myPet，否則就更新所有 selector 的路徑
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
