// src/screens/profile/ProfileMatchScreen.tsx
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
  fetchCandidateProfiles,
  fetchRelationSets,
  sendFriendRequest,
} from "../../lib/supabase/repos/friends.repo"
import { createOrGetDm } from "../../lib/supabase/repos/message.repo"

export default function ProfileMatchScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()

  const [myId, setMyId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [all, setAll] = useState<ProfileRow[]>([])
  const [friends, setFriends] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [blocked, setBlocked] = useState<Set<string>>(new Set())

  const [query, setQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const uid = await getAuthedUserId()
      setMyId(uid)

      if (!uid) {
        setAll([])
        setFriends(new Set())
        setPending(new Set())
        setBlocked(new Set())
        return
      }

      const [{ friends, pending, blockedEitherWay }, profiles] = await Promise
        .all([
          fetchRelationSets(uid),
          fetchCandidateProfiles(),
        ])

      setFriends(friends)
      setPending(pending)
      setBlocked(blockedEitherWay)

      setAll(profiles)
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

  const candidates = useMemo(() => {
    const uid = myId
    if (!uid) return []

    const q = query.trim().toLowerCase()

    return all
      .filter((p) => p.id !== uid)
      .filter((p) => !friends.has(p.id))
      .filter((p) => !pending.has(p.id))
      .filter((p) => !blocked.has(p.id))
      .filter((p) => {
        if (!q) return true
        return (p.display_name ?? "").toLowerCase().includes(q)
      })
      .slice(0, 40)
  }, [all, blocked, friends, myId, pending, query])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t("match.loading")}</Text>
      </View>
    )
  }

  if (!myId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("match.title")}</Text>
        <Text style={styles.muted}>{t("match.signInToUse")}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("match.title")}</Text>
      <Text style={styles.muted}>{t("match.subtitle")}</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("match.searchPlaceholder")}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.display_name}</Text>
              {!!item.location_city && (
                <Text style={styles.muted}>{item.location_city}</Text>
              )}
              {!!item.bio && (
                <Text style={styles.bio} numberOfLines={2}>
                  {item.bio}
                </Text>
              )}
            </View>

            {/* Message */}
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={async () => {
                try {
                  const res = await createOrGetDm(item.id)
                  if (!res) {
                    Alert.alert(
                      t("match.alerts.errorTitle"),
                      t("match.alerts.createConversationFailed"),
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
                    t("match.alerts.errorTitle"),
                    t("match.alerts.openChatFailed"),
                  )
                }
              }}
            >
              <Text style={styles.btnTextGhost}>
                {t("match.actions.message")}
              </Text>
            </TouchableOpacity>

            {/* Add */}
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                try {
                  await sendFriendRequest(myId, item.id)
                  Alert.alert(
                    t("match.alerts.sentTitle"),
                    t("match.alerts.requestSentTo", {
                      name: item.display_name,
                    }),
                  )
                  await load()
                } catch {
                  Alert.alert(
                    t("match.alerts.errorTitle"),
                    t("match.alerts.sendRequestFailed"),
                  )
                }
              }}
            >
              <Text style={styles.btnTextPrimary}>
                {t("match.actions.add")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.muted}>{t("match.list.empty")}</Text>
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

  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  muted: { color: "#777" },

  search: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 12,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  name: { fontSize: 16, fontWeight: "700" },
  bio: { marginTop: 6, color: "#444" },

  btnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#111",
  },
  btnTextPrimary: { color: "#fff", fontWeight: "800" },

  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "transparent",
  },
  btnTextGhost: { color: "#333", fontWeight: "700" },
})
