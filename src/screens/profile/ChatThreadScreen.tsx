// src/screens/profile/ChatThreadScreen.tsx
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native"
import {
  type RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { useHeaderHeight } from "@react-navigation/elements"
import { useTranslation } from "react-i18next"

import { theme } from "../../styles/tokens"
import { useThemeColors } from "../../styles/themesColors"
import MessageInputBar from "../../components/chat/MessageInputBar"
import MessageBubble from "../../components/chat/MessageBubble"
import { useConversationThread } from "../../hooks/useConversationThread"
import type {
  MessageRow,
  OtherProfile,
} from "../../lib/supabase/repos/chat.repo"

type ChatThreadRoute = RouteProp<
  { ChatThread: { conversationId: string } },
  "ChatThread"
>

const formatChatTime = (ts: string) => {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, "0")}:${
    String(d.getMinutes()).padStart(2, "0")
  }`
}

const Avatar = ({ url, size = 32 }: { url?: string | null; size?: number }) => (
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

export default function ChatThreadScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { colors } = useThemeColors()
  const headerHeight = useHeaderHeight()
  const route = useRoute<ChatThreadRoute>()
  const { conversationId } = route.params

  const textDim = (colors?.subText ?? "#97A3B6") as string
  const listRef = useRef<FlatList<MessageRow>>(null)

  const [text, setText] = useState("")
  const [, setInputBarHeight] = useState(72)
  const [liftPx, setLiftPx] = useState(0)

  const { loading, myId, otherProfile, messages, sending, send } =
    useConversationThread(conversationId, {
      pageLimit: 30,
      enableFallbackPolling: true,
      pollIntervalMs: 15000,
      debug: __DEV__,
    })

  // header
  useEffect(() => {
    const p: OtherProfile | null = otherProfile
    if (p) {
      navigation.setOptions({
        headerTitle: () => (
          <View style={styles.headerTitleContainer}>
            <Avatar url={p.avatar} size={32} />
            <Text
              style={[styles.headerName, { color: colors.text }]}
              numberOfLines={1}
            >
              {p.name}
            </Text>
          </View>
        ),
      })
    } else {
      navigation.setOptions({ title: t("chat.thread.titleFallback") })
    }
  }, [colors.text, navigation, otherProfile, t])

  const onSend = useCallback(async () => {
    const body = text.trim()
    if (!body) return
    setText("")
    const msg = await send(body)
    if (msg) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
      })
    }
  }, [send, text])

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingTop: theme.spacing.md +
                  (Platform.OS === "android" ? liftPx : 0),
                paddingBottom: theme.spacing.lg,
              },
            ]}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                isMine={item.sender_id === myId}
                colors={colors}
                textDim={textDim}
                otherAvatar={otherProfile?.avatar}
                formatTime={formatChatTime}
              />
            )}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          />
        </View>

        <MessageInputBar
          value={text}
          onChangeText={setText}
          onSend={onSend}
          sending={sending}
          colors={colors}
          textDim={textDim}
          onHeightChange={setInputBarHeight}
          onLiftPxChange={setLiftPx}
          androidCandidateBar={84}
          extraGap={12}
        />
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 240,
  },
  headerName: { fontWeight: "700", fontSize: 16 },
  listContent: { paddingHorizontal: theme.spacing.md },
  avatarPlaceholder: {
    backgroundColor: "#202637",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
})
