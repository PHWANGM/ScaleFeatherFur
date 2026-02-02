// src/hooks/useConversationThread.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, type AppStateStatus } from "react-native"
import { useFocusEffect, useIsFocused } from "@react-navigation/native"

import { syncRealtimeAuthForNextConnect } from "../lib/supabase"
import {
  loadChatThreadInitial,
  sendChatMessage,
  subscribeChatThread,
  type MessageRow,
  type OtherProfile,
} from "../lib/supabase/repos/chat.repo"

type Options = {
  pageLimit?: number
  // Realtime 掛了才 polling（預設 true）
  enableFallbackPolling?: boolean
  pollIntervalMs?: number
  // debug 時印 realtime status/payload（預設 dev 才開）
  debug?: boolean
}

function mergeMessagesNewestFirst(prev: MessageRow[], incoming: MessageRow[]) {
  const map = new Map<string, MessageRow>()
  for (const m of prev) map.set(m.id, m)
  for (const m of incoming) map.set(m.id, m)
  const arr = Array.from(map.values())
  arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return arr
}

export function useConversationThread(conversationId: string, opts?: Options) {
  const options = useMemo(
    () => ({
      pageLimit: 30,
      enableFallbackPolling: true,
      pollIntervalMs: 15000,
      debug: __DEV__,
      ...(opts ?? {}),
    }),
    [opts],
  )

  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState<string | null>(null)
  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [sending, setSending] = useState(false)

  const myIdRef = useRef<string | null>(null)
  const unsubRef = useRef<null | (() => void)>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (!pollRef.current) return
    clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const startPolling = useCallback(() => {
    if (!options.enableFallbackPolling) return
    if (pollRef.current) return
    pollRef.current = setInterval(() => {
      void silentRefresh()
    }, options.pollIntervalMs)
  }, [options.enableFallbackPolling, options.pollIntervalMs])

  const cleanup = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null

    stopPolling()

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [stopPolling])

  const loadInitial = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    try {
      const res = await loadChatThreadInitial({
        conversationId,
        pageLimit: options.pageLimit,
      })
      myIdRef.current = res.myId
      setMyId(res.myId)
      setOtherProfile(res.otherProfile)
      setMessages(res.messages)
    } finally {
      setLoading(false)
    }
  }, [conversationId, options.pageLimit])

  const silentRefresh = useCallback(async () => {
    if (!conversationId) return
    const res = await loadChatThreadInitial({
      conversationId,
      pageLimit: options.pageLimit,
    })
    myIdRef.current = res.myId
    setMyId(res.myId)
    setOtherProfile(res.otherProfile)
    setMessages((prev) => mergeMessagesNewestFirst(prev, res.messages))
  }, [conversationId, options.pageLimit])

  const scheduleRetry = useCallback(() => {
    if (!isFocused) return
    if (retryTimerRef.current) return
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null
      if (isFocused) void startSubscription()
    }, 800)
  }, [isFocused])

  const startSubscription = useCallback(async () => {
    const uid = myIdRef.current
    if (!conversationId || !uid) return

    // ✅ 保留你原本的 auth sync（必要時會 disconnect，讓下一次 subscribe 帶新 JWT）
    await syncRealtimeAuthForNextConnect()

    // 先清乾淨再重建
    unsubRef.current?.()
    unsubRef.current = null

    const unsub = subscribeChatThread({
      conversationId,
      myId: uid,
      autoMarkRead: true,
      onInsert: async (msg) => {
        // 去重 + 新訊息插入
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [msg, ...prev]))
      },
      onStatus: async (status) => {
        if (options.debug) {
          console.log("[rt] status", status, conversationId)
        }

        if (status === "SUBSCRIBED") {
          // realtime 活著：停掉 polling + 補拉一次避免空窗漏訊
          stopPolling()
          try {
            await silentRefresh()
          } catch {
            // ignore
          }
          return
        }

        if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
          // realtime 不穩：啟動 polling 當備援 + 排程重連
          startPolling()
          scheduleRetry()
        }
      },
    })

    unsubRef.current = unsub
  }, [
    conversationId,
    options.debug,
    scheduleRetry,
    silentRefresh,
    startPolling,
    stopPolling,
  ])

  const send = useCallback(
    async (body: string) => {
      const uid = myIdRef.current
      const text = body.trim()
      if (!conversationId || !uid || !text || sending) return null

      setSending(true)
      try {
        const msg = await sendChatMessage({ conversationId, myId: uid, body: text })
        if (msg) {
          // optimistic insert（同時 realtime 也會來一份，但你有去重）
          setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [msg, ...prev]))
        }
        return msg
      } finally {
        setSending(false)
      }
    },
    [conversationId, sending],
  )

  // Focus：進畫面 load + subscribe；離開畫面 cleanup
  useFocusEffect(
    useCallback(() => {
      let alive = true
      ;(async () => {
        try {
          await loadInitial()
        } catch {
          // ignore
        }
        if (!alive) return
        void startSubscription()
      })()

      return () => {
        alive = false
        cleanup()
      }
    }, [cleanup, loadInitial, startSubscription]),
  )

  // 回前景：補拉一次 + 重建訂閱（行動網路/省電常會斷 WS）
  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === "active" && isFocused) {
        void silentRefresh()
        void startSubscription()
      }
    }
    const sub = AppState.addEventListener("change", onAppState)
    return () => sub.remove()
  }, [isFocused, silentRefresh, startSubscription])

  return {
    loading,
    myId,
    otherProfile,
    messages,
    sending,
    refresh: silentRefresh,
    send,
  }
}
