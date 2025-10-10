import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MyPetState = {
  currentPetId: string | null;
  calendar: { selectedDate: string | null }; // ✅ 正確拼字 calendar
};

const initialState: MyPetState = {
  currentPetId: null,
  calendar: { selectedDate: null },
};

const myPetSlice = createSlice({
  name: 'myPet',
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

// 型別安全 selectors（建議用這些）
export const selectCurrentPetId = (s: any) => (s?.myPet?.currentPetId ?? null);
export const selectSelectedDate = (s: any) =>
  (s?.myPet?.calendar?.selectedDate ?? s?.myPet?.calendar?.selectedDate ?? null);
