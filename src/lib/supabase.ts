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
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      log_level: "info",
    },
  },
})

let lastRealtimeToken: string | null = null

/**
 * ✅ 安全版：只做兩件事
 * 1) supabase.realtime.setAuth(token)
 * 2) supabase.realtime.disconnect()（不 connect）
 *
 * 目的：讓「下一次 subscribe」建立的 WS 一定帶上 JWT
 * - 不會干擾登入流程
 * - 不會造成 connect/reconnect 迴圈
 */
export async function syncRealtimeAuthForNextConnect(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? null
    if (!token) return

    // token 沒變也 setAuth 一下（安全）
    supabase.realtime.setAuth(token)

    // token 變了才需要斷線，讓下一次 subscribe 用新 token 建連線
    if (token !== lastRealtimeToken) {
      lastRealtimeToken = token
      try {
        supabase.realtime.disconnect()
      } catch {
        // ignore
      }
      // 注意：不要 connect()，讓 subscribe 自己觸發 connect
    }
  } catch {
    // ignore
  }
}

// 登入/refresh 時：不要 await、不要 connect；只做 setAuth + disconnect
supabase.auth.onAuthStateChange((_event, session) => {
  const token = session?.access_token ?? null
  if (!token) {
    lastRealtimeToken = null
    return
  }
  try {
    supabase.realtime.setAuth(token)
    if (token !== lastRealtimeToken) {
      lastRealtimeToken = token
      try {
        supabase.realtime.disconnect()
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
})
