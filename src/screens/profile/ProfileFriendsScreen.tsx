// src/screens/profile/ProfileFriendsScreen.tsx
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../navigation/rootNavigator"
import { useTranslation } from "react-i18next"

import {
  getAuthedUserId,
  type ProfileRow,
} from "../../lib/supabase/repos/profile.repo"
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriendIds,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  fetchProfilesByIds,
  type FriendItem,
  type FriendRequestRow,
  rejectFriendRequest,
  removeFriend as removeFriendRepo,
} from "../../lib/supabase/repos/friends.repo"
import { createOrGetDm } from "../../lib/supabase/repos/message.repo"

export default function ProfileFriendsScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()

  const [myId, setMyId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [friendItems, setFriendItems] = useState<FriendItem[]>([])
  const [incoming, setIncoming] = useState<
    Array<FriendRequestRow & { fromProfile?: ProfileRow | null }>
  >([])
  const [outgoing, setOutgoing] = useState<
    Array<FriendRequestRow & { toProfile?: ProfileRow | null }>
  >([])

  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const uid = await getAuthedUserId()
      setMyId(uid)

      if (!uid) {
        setFriendItems([])
        setIncoming([])
        setOutgoing([])
        return
      }

      const [friendIds, inReqs, outReqs] = await Promise.all([
        fetchFriendIds(uid),
        fetchIncomingRequests(uid),
        fetchOutgoingRequests(uid),
      ])

      const profileIds = Array.from(
        new Set<string>([
          ...friendIds,
          ...inReqs.map((r) => r.from_user_id),
          ...outReqs.map((r) => r.to_user_id),
        ]),
      )

      const map = await fetchProfilesByIds(profileIds)

      setFriendItems(
        friendIds.map((id) => ({
          userId: id,
          profile: map[id] ?? null,
        })),
      )

      setIncoming(
        inReqs.map((r) => ({ ...r, fromProfile: map[r.from_user_id] ?? null })),
      )
      setOutgoing(
        outReqs.map((r) => ({ ...r, toProfile: map[r.to_user_id] ?? null })),
      )
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

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friendItems
    return friendItems.filter((f) =>
      (f.profile?.display_name ?? "").toLowerCase().includes(q)
    )
  }, [friendItems, query])

  const renderSectionHeader = (title: string, subtitle?: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t("friends.loading")}</Text>
      </View>
    )
  }

  if (!myId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("friends.title")}</Text>
        <Text style={styles.muted}>{t("friends.signInToUse")}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("friends.title")}</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("friends.searchPlaceholder")}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Incoming Requests */}
      {renderSectionHeader(
        t("friends.sections.requests"),
        incoming.length
          ? t("friends.incoming.count", { count: incoming.length })
          : t("friends.incoming.none"),
      )}

      {incoming.length > 0 && (
        <View style={styles.card}>
          {incoming.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {r.fromProfile?.display_name ?? r.from_user_id}
                </Text>
                <Text style={styles.muted}>
                  {t("friends.incoming.wantsToAddYou")}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  try {
                    await acceptFriendRequest(r)
                    await load()
                  } catch {
                    Alert.alert(
                      t("friends.alerts.errorTitle"),
                      t("friends.alerts.acceptFailed"),
                    )
                  }
                }}
              >
                <Text style={styles.btnTextPrimary}>
                  {t("friends.incoming.accept")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={async () => {
                  try {
                    await rejectFriendRequest(r.id)
                    await load()
                  } catch {
                    Alert.alert(
                      t("friends.alerts.errorTitle"),
                      t("friends.alerts.rejectFailed"),
                    )
                  }
                }}
              >
                <Text style={styles.btnTextGhost}>
                  {t("friends.incoming.reject")}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Outgoing Requests */}
      {renderSectionHeader(
        t("friends.sections.pendingSent"),
        outgoing.length
          ? t("friends.outgoing.count", { count: outgoing.length })
          : t("friends.outgoing.none"),
      )}

      {outgoing.length > 0 && (
        <View style={styles.card}>
          {outgoing.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {r.toProfile?.display_name ?? r.to_user_id}
                </Text>
                <Text style={styles.muted}>
                  {t("friends.outgoing.pending")}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={async () => {
                  try {
                    await cancelFriendRequest(r.id)
                    await load()
                  } catch {
                    Alert.alert(
                      t("friends.alerts.errorTitle"),
                      t("friends.alerts.cancelFailed"),
                    )
                  }
                }}
              >
                <Text style={styles.btnTextGhost}>
                  {t("friends.outgoing.cancel")}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Friends List */}
      {renderSectionHeader(
        t("friends.sections.yourFriends"),
        t("friends.list.count", { count: filteredFriends.length }),
      )}

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.friendRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {item.profile?.display_name ?? item.userId}
              </Text>
              {!!item.profile?.location_city && (
                <Text style={styles.muted}>{item.profile.location_city}</Text>
              )}
            </View>

            {/* Message */}
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={async () => {
                try {
                  const res = await createOrGetDm(item.userId)
                  if (!res) {
                    Alert.alert(
                      t("friends.alerts.errorTitle"),
                      t("friends.alerts.createConversationFailed"),
                    )
                    return
                  }
                  navigation.navigate(
                    "ChatThread",
                    {
                      conversationId: res.conversationId,
                      title: res.title,
                    } as never,
                  )
                } catch {
                  Alert.alert(
                    t("friends.alerts.errorTitle"),
                    t("friends.alerts.openChatFailed"),
                  )
                }
              }}
            >
              <Text style={styles.btnTextGhost}>
                {t("friends.actions.message")}
              </Text>
            </TouchableOpacity>

            {/* Remove */}
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                const name = item.profile?.display_name ??
                  t("friends.alerts.unknownUser")
                Alert.alert(
                  t("friends.alerts.removeConfirmTitle"),
                  t("friends.alerts.removeConfirmMessage", { name }),
                  [
                    { text: t("friends.alerts.cancel"), style: "cancel" },
                    {
                      text: t("friends.alerts.removeDestructive"),
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await removeFriendRepo(myId, item.userId)
                          await load()
                        } catch {
                          Alert.alert(
                            t("friends.alerts.errorTitle"),
                            t("friends.alerts.removeFailed"),
                          )
                        }
                      },
                    },
                  ],
                )
              }}
            >
              <Text style={styles.btnTextPrimary}>
                {t("friends.actions.remove")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.muted}>{t("friends.list.empty")}</Text>
        }
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

  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  muted: { color: "#777", marginTop: 4 },

  search: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  sectionHeader: { marginTop: 10, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionSubtitle: { color: "#777", marginTop: 2 },

  card: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },

  rowTitle: { fontSize: 15, fontWeight: "600" },

  btn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnPrimary: { backgroundColor: "#111", borderColor: "#111" },
  btnDanger: { backgroundColor: "#c62828", borderColor: "#c62828" },
  btnGhost: { backgroundColor: "transparent", borderColor: "#ddd" },

  btnTextPrimary: { color: "#fff", fontWeight: "700" },
  btnTextGhost: { color: "#333", fontWeight: "600" },
})
