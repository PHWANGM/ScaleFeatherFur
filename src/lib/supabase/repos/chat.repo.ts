// src/lib/supabase/repos/chat.repo.ts
import { supabase } from "../../supabase"
import { getAuthedUserId } from "./profile.repo"
import {
  fetchMessagesPage,
  markConversationRead,
  type MessageRow,
  sendMessage,
  subscribeToConversationMessages,
} from "./message.repo"

export type OtherProfile = { name: string; avatar: string | null }

export async function fetchOtherParticipantProfile(params: {
  conversationId: string
  myUserId: string
}): Promise<OtherProfile | null> {
  const { conversationId, myUserId } = params

  const { data, error } = await supabase
    .from("conversation_members")
    .select("user_id, profiles(display_name, avatar_url)")
    .eq("conversation_id", conversationId)
    .neq("user_id", myUserId)
    .single()

  if (error || !data) return null

  const profile = (data as {
    profiles?:
      | { display_name?: string | null; avatar_url?: string | null }
      | null
  }).profiles
  if (!profile) return null

  return {
    name: profile.display_name ?? "",
    avatar: profile.avatar_url ?? null,
  }
}

export async function loadChatThreadInitial(params: {
  conversationId: string
  pageLimit?: number
}): Promise<{
  myId: string | null
  otherProfile: OtherProfile | null
  messages: MessageRow[]
}> {
  const { conversationId, pageLimit = 30 } = params

  const myId = await getAuthedUserId()
  if (!myId) {
    return { myId: null, otherProfile: null, messages: [] }
  }

  const [otherProfile, messages] = await Promise.all([
    fetchOtherParticipantProfile({ conversationId, myUserId: myId }),
    fetchMessagesPage({ conversationId, limit: pageLimit }),
  ])

  try {
    await markConversationRead(conversationId, myId)
  } catch {
    // ignore
  }

  return { myId, otherProfile, messages }
}

export function subscribeChatThread(params: {
  conversationId: string
  myId: string
  onInsert: (msg: MessageRow) => void | Promise<void>
  autoMarkRead?: boolean
  onStatus?: (status: string) => void
}) {
  const { conversationId, myId, onInsert, autoMarkRead = true, onStatus } = params

  return subscribeToConversationMessages({
    conversationId,
    onStatus,
    onInsert: async (msg) => {
      await onInsert(msg)

      if (autoMarkRead && msg.sender_id !== myId) {
        try {
          await markConversationRead(conversationId, myId)
        } catch {
          // ignore
        }
      }
    },
  })
}

export async function sendChatMessage(params: {
  conversationId: string
  myId: string
  body: string
}): Promise<MessageRow | null> {
  const { conversationId, myId, body } = params
  const text = body.trim()
  if (!text) return null

  const msg = await sendMessage({ conversationId, senderId: myId, body: text })
  return msg ?? null
}

export async function markThreadRead(params: {
  conversationId: string
  myId: string
}): Promise<void> {
  const { conversationId, myId } = params
  await markConversationRead(conversationId, myId)
}
