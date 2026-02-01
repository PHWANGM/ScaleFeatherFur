// src/lib/supabase.ts
import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import { Buffer } from "buffer"
const globalWithBuffer = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer
  process?: { env: Record<string, string | undefined> }
}
globalWithBuffer.Buffer ??= Buffer

const process = globalWithBuffer.process as {
  env: Record<string, string | undefined>
}
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RN/Expo 要關掉
  },
})
