// src/state/slices/uvbSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type UVBSession = {
  active: boolean;
  startAtIso: string | null;
  timerStartMs: number | null;
  durationMinutes: number;
};

export type UVBSessionState = {
  sessions: Record<string, UVBSession>;
};

const defaultSession: UVBSession = {
  active: false,
  startAtIso: null,
  timerStartMs: null,
  durationMinutes: 30,
};

const initialState: UVBSessionState = {
  sessions: {},
};

type StartPayload = {
  petId: string;
  startAtIso: string;
  timerStartMs: number;
  durationMinutes: number;
};

const uvbSlice = createSlice({
  name: 'uvb',
  initialState,
  reducers: {
    startSession(state, action: PayloadAction<StartPayload>) {
      state.sessions[action.payload.petId] = {
        active: true,
        startAtIso: action.payload.startAtIso,
        timerStartMs: action.payload.timerStartMs,
        durationMinutes: action.payload.durationMinutes,
      };
    },
    endSession(state, action: PayloadAction<{ petId: string }>) {
      state.sessions[action.payload.petId] = {
        ...defaultSession,
      };
    },
  },
});

export const { startSession, endSession } = uvbSlice.actions;
export default uvbSlice.reducer;

type RootLike = { uvb?: UVBSessionState };
const getSlice = (s: RootLike): UVBSessionState => s.uvb ?? initialState;
export const selectUvbSessionByPetId = (s: RootLike, petId: string | null) => {
  if (!petId) return defaultSession;
  return getSlice(s).sessions[petId] ?? defaultSession;
};
