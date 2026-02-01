// src/components/chat/MessageBubble.tsx
import { useMemo } from "react"
import { Image, StyleSheet, Text, View } from "react-native"

import { theme } from "../../styles/tokens"
import { type MessageRow } from "../../lib/supabase/repos/message.repo"

type MessageBubbleColors = {
  primary: string
  card: string
  border: string
  text: string
}

type AvatarProps = { url?: string | null; size?: number }

const Avatar = ({ url, size = 32 }: AvatarProps) => (
  <View
    style={[styles.avatarPlaceholder, {
      width: size,
      height: size,
      borderRadius: size / 2,
    }]}
  >
    {url
      ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      )
      : <Text style={{ fontSize: size * 0.4, color: "#fff" }}>🐾</Text>}
  </View>
)

export type MessageBubbleProps = {
  item: MessageRow
  isMine: boolean
  colors: MessageBubbleColors
  textDim: string
  otherAvatar?: string | null

  /** 可選：覆寫時間格式（預設 HH:mm） */
  formatTime?: (ts: string) => string
}

const defaultFormatTime = (ts: string) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, "0")}:${
    String(d.getMinutes()).padStart(2, "0")
  }`
}

export default function MessageBubble({
  item,
  isMine,
  colors,
  textDim,
  otherAvatar,
  formatTime,
}: MessageBubbleProps) {
  const timeText = useMemo(() => {
    const fn = formatTime ?? defaultFormatTime
    return fn(item.created_at)
  }, [formatTime, item.created_at])

  return (
    <View
      style={[
        styles.bubbleWrapper,
        isMine ? styles.mineWrapper : styles.otherWrapper,
      ]}
    >
      {!isMine && <Avatar url={otherAvatar} size={36} />}

      <View
        style={[
          styles.bubbleContainer,
          isMine ? { alignItems: "flex-end" } : { marginLeft: 8 },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMine ? colors.primary : colors.card,
              borderBottomRightRadius: isMine ? 4 : theme.radii.lg,
              borderBottomLeftRadius: isMine ? theme.radii.lg : 4,
              borderColor: isMine ? "transparent" : colors.border,
              borderWidth: isMine ? 0 : 1,
            },
          ]}
        >
          <Text
            style={[styles.messageText, {
              color: isMine ? "#122017" : colors.text,
            }]}
          >
            {item.body}
          </Text>
          <Text
            style={[
              styles.timestamp,
              {
                color: isMine ? "rgba(0,0,0,0.4)" : textDim,
                textAlign: isMine ? "right" : "left",
              },
            ]}
          >
            {timeText}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bubbleWrapper: {
    marginBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  mineWrapper: { justifyContent: "flex-end" },
  otherWrapper: { justifyContent: "flex-start" },
  bubbleContainer: { maxWidth: "75%" },

  avatarPlaceholder: {
    backgroundColor: "#202637",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  bubble: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    ...theme.shadows.card,
    shadowOpacity: 0.05,
  },
  messageText: { ...theme.typography.body, fontSize: 16, lineHeight: 22 },
  timestamp: {
    ...theme.typography.small,
    marginTop: 4,
    fontSize: 10,
    opacity: 0.6,
  },
})
