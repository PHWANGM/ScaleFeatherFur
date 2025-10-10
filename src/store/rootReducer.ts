import { combineReducers } from '@reduxjs/toolkit';
import myPet from './myPetSlice';

export const rootReducer = combineReducers({
  myPet, // ✅ KEY 一定要叫 myPet
  // ...other reducers
});

export type RootState = ReturnType<typeof rootReducer>;
