// src/screens/profile/ProfileMessagesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../navigation/rootNavigator"
import { useTranslation } from "react-i18next"

import { getAuthedUserId } from "../../lib/supabase/repos/profile.repo"
import {
  type ConversationListItem,
  fetchConversationSummaries,
  markConversationRead,
  toConversationListItems,
} from "../../lib/supabase/repos/message.repo"

export default function ProfileMessagesScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()

  const [myId, setMyId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [items, setItems] = useState<ConversationListItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const uid = await getAuthedUserId()
      setMyId(uid)

      if (!uid) {
        setItems([])
        return
      }

      const rows = await fetchConversationSummaries(uid)
      setItems(toConversationListItems(rows))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const empty = useMemo(() => items.length === 0, [items])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t("messages.loading")}</Text>
      </View>
    )
  }

  if (!myId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("messages.title")}</Text>
        <Text style={styles.muted}>{t("messages.signInToUse")}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("messages.title")}</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.conversation_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, item.unread && styles.rowUnread]}
            onPress={async () => {
              try {
                await markConversationRead(item.conversation_id, myId)
                await load()

                navigation.navigate("ChatThread", {
                  conversationId: item.conversation_id,
                  title: item.displayTitle,
                })
              } catch {
                Alert.alert(
                  t("messages.alerts.errorTitle"),
                  t("messages.alerts.openChatFailed"),
                )
              }
            }}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.topLine}>
                <Text
                  style={[styles.name, item.unread && styles.nameUnread]}
                  numberOfLines={1}
                >
                  {item.displayTitle}
                </Text>
                <Text style={styles.time}>{item.timeLabel}</Text>
              </View>

              <Text
                style={[styles.preview, item.unread && styles.previewUnread]}
                numberOfLines={1}
              >
                {item.preview}
              </Text>
            </View>

            {item.unread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? "99+" : String(item.unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={empty
          ? (
            <View style={{ paddingTop: 16 }}>
              <Text style={styles.muted}>{t("messages.empty.line1")}</Text>
              <Text style={styles.muted}>{t("messages.empty.line2")}</Text>
            </View>
          )
          : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  muted: { color: "#777", marginTop: 6 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  rowUnread: { borderColor: "#ddd" },

  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { fontSize: 16, fontWeight: "700", flex: 1 },
  nameUnread: { fontWeight: "900" },
  time: { color: "#777", fontSize: 12 },

  preview: { color: "#555", marginTop: 6 },
  previewUnread: { color: "#222", fontWeight: "700" },

  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
})
