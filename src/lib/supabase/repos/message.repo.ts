import { supabase } from "../../supabase"

export type ConversationSummaryRow = {
  viewer_id: string
  conversation_id: string
  is_group: boolean
  title: string | null
  last_message_at: string | null
  last_message_text: string | null
  last_message_sender_id: string | null
  last_read_at: string | null
  unread_count: number | null

  other_user_id: string | null
  other_display_name: string | null
  other_avatar_url: string | null
}

export type ConversationListItem = ConversationSummaryRow & {
  displayTitle: string
  preview: string
  timeLabel: string
  unread: boolean
  unreadCount: number
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  deleted_at?: string | null
}

export function formatTime(ts: string | null) {
  if (!ts) return ""
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${mm}/${dd} ${hh}:${mi}`
}

export function toConversationListItems(
  rows: ConversationSummaryRow[],
): ConversationListItem[] {
  return rows.map((r) => {
    const unreadCount = r.unread_count ?? 0
    return {
      ...r,
      unread_count: unreadCount,
      unreadCount,
      unread: unreadCount > 0,
      displayTitle: r.is_group
        ? (r.title ?? "Group")
        : (r.other_display_name ?? "Unknown"),
      preview: r.last_message_text ??
        (r.last_message_at ? "(no preview)" : "Start a conversation"),
      timeLabel: formatTime(r.last_message_at),
    }
  })
}

// ===== List =====
export async function fetchConversationSummaries(
  myId: string,
): Promise<ConversationSummaryRow[]> {
  const { data, error } = await supabase
    .from("conversation_summaries")
    .select(
      "viewer_id, conversation_id, is_group, title, last_message_at, last_message_text, last_message_sender_id, last_read_at, unread_count, other_user_id, other_display_name, other_avatar_url",
    )
    .eq("viewer_id", myId)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  if (error) {
    console.warn("[message.repo] fetchConversationSummaries error:", error)
    return []
  }
  return (data ?? []) as ConversationSummaryRow[]
}

export async function markConversationRead(
  conversationId: string,
  myId: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", myId)

  if (error) console.warn("[message.repo] markConversationRead error:", error)
}

export async function createOrGetDm(
  otherUserId: string,
): Promise<{ conversationId: string; title?: string } | null> {
  const { data, error } = await supabase.rpc("create_or_get_dm", {
    other_user_id: otherUserId,
  })

  if (error) {
    console.warn("[message.repo] createOrGetDm rpc error:", error)
    return null
  }

  const conversationId = (data as unknown as string) ?? null
  if (!conversationId) return null

  let title: string | undefined
  try {
    const { data: p, error: pErr } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", otherUserId)
      .single()
    if (!pErr && p?.display_name) title = p.display_name
  } catch {
    // ignore
  }

  return { conversationId, title }
}

// ===== Thread =====
export async function fetchMessagesPage(params: {
  conversationId: string
  limit?: number
  beforeCreatedAt?: string | null
}): Promise<MessageRow[]> {
  const { conversationId, limit = 30, beforeCreatedAt = null } = params

  let q = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, deleted_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (beforeCreatedAt) q = q.lt("created_at", beforeCreatedAt)

  const { data, error } = await q

  if (error) {
    console.warn("[message.repo] fetchMessagesPage error:", error)
    return []
  }
  return (data ?? []) as MessageRow[]
}

export async function sendMessage(params: {
  conversationId: string
  senderId: string
  body: string
}): Promise<MessageRow | null> {
  const { conversationId, senderId, body } = params
  const trimmed = body.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select("id, conversation_id, sender_id, body, created_at, deleted_at")
    .single()

  if (error) {
    console.warn("[message.repo] sendMessage error:", error)
    return null
  }
  return (data ?? null) as MessageRow | null
}

/**
 * ✅ 收斂版 realtime subscribe：
 * - channel name 穩定
 * - 只聽 INSERT
 * - filter 固定 conversation_id
 * - unsubscribe 乾淨 removeChannel
 */
export function subscribeToConversationMessages(params: {
  conversationId: string
  onInsert: (msg: MessageRow) => void
  onStatus?: (status: string) => void
}) {
  const { conversationId, onInsert, onStatus } = params

  const channel = supabase
    .channel(`rt:messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        console.log("[rt] payload", payload) // ✅ 直接看有沒有收到
        const msg = payload.new as MessageRow
        if (msg?.deleted_at) return
        onInsert(msg)
      },
    )
    .subscribe((status) => {
      console.log("[rt] status", status, conversationId) // ✅ 核心
      onStatus?.(status)
    })

  return () => {
    supabase.removeChannel(channel)
  }
}
