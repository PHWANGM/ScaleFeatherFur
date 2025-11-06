// src/state/slices/petsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MyPetState = {
  currentPetId: string | null;
  calendar: { selectedDate: string | null };
};

const initialState: MyPetState = {
  currentPetId: null,
  calendar: { selectedDate: null },
};

const myPetSlice = createSlice({
  name: 'pets', // ←名稱隨意，重要的是 store 的 key；下方 selectors 會同時支援 pets/myPet
  initialState,
  reducers: {
    setCurrentPetId(state, action: PayloadAction<string | null>) {
      state.currentPetId = action.payload;
    },
    setSelectedDate(state, action: PayloadAction<string | null>) {
      state.calendar.selectedDate = action.payload;
    },
  },
});

export const { setCurrentPetId, setSelectedDate } = myPetSlice.actions;
export default myPetSlice.reducer;

// --------- 型別安全 selectors（同時容忍 store key = pets 或 myPet）---------
type RootLike = { pets?: MyPetState; myPet?: MyPetState };

const getSlice = (s: RootLike): MyPetState => (s.pets ?? s.myPet ?? initialState);

export const selectCurrentPetId = (s: RootLike) => getSlice(s).currentPetId;
export const selectSelectedDate = (s: RootLike) => getSlice(s).calendar.selectedDate;
