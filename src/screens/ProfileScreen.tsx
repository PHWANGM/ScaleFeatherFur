// src/screens/ProfileScreen.tsx
import React, { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../navigation/rootNavigator"
import { useTranslation } from "react-i18next"

import { theme } from "../styles/tokens"
import { useThemeColors } from "../styles/themesColors"
import { countPets } from "../lib/db/repos/pets.repo"
import { supabase } from "../lib/supabase"

// badges
import { fetchConversationSummaries } from "../lib/supabase/repos/message.repo"
import { fetchIncomingRequests } from "../lib/supabase/repos/friends.repo"

// ✅ local points (offline)
import { getTotalPointsAllPets } from "../lib/db/repos/tasks.repo"

// ✅ cloud points (online, merged by user_id)
import { getUserPointsTotal } from "../lib/supabase/repos/tasks.repo"

type ActionItem = {
  key: string
  title: string
  sub?: string
  badge?: number
  requiresAuth?: boolean
  onPress: () => void
}

type ProfileRow = {
  id: string
  display_name: string
  avatar_url?: string | null
  bio?: string | null
  location_city?: string | null
}

export default function ProfileScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()
  const { colors } = useThemeColors()

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? colors.textDim ?? "#97A3B6",
      border: colors.border,
      primary: colors.primary ?? "#38e07b",
    }),
    [colors],
  )

  // ===== Local stats =====
  const [petCount, setPetCount] = useState<number>(0)

  // points source:
  // - signed out -> local points
  // - signed in  -> cloud points
  const [taskPoints, setTaskPoints] = useState<number>(0)
  const [pointsSource, setPointsSource] = useState<"local" | "cloud">("local")
  const [pointsLoading, setPointsLoading] = useState<boolean>(true)
  const [pointsError, setPointsError] = useState<string | null>(null)

  // ===== Auth/profile =====
  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [postCount, setPostCount] = useState<number>(0)
  const [friendCount, setFriendCount] = useState<number>(0)

  // ===== Badges =====
  const [unreadMessages, setUnreadMessages] = useState<number>(0)
  const [incomingReqCount, setIncomingReqCount] = useState<number>(0)

  const badges = useMemo(
    () => ({
      messages: unreadMessages,
      friendRequests: incomingReqCount,
    }),
    [unreadMessages, incomingReqCount],
  )

  const isSignedIn = !!userId

  // ===== Loaders =====
  const loadLocalStats = useCallback(async () => {
    const [count, localTotal] = await Promise.all([
      countPets(),
      getTotalPointsAllPets(),
    ])
    setPetCount(count)
    return { localTotal }
  }, [])

  const loadCloudPointsIfSignedIn = useCallback(async (signedIn: boolean) => {
    setPointsLoading(true)
    setPointsError(null)
    try {
      if (!signedIn) {
        const localTotal = await getTotalPointsAllPets()
        setTaskPoints(localTotal)
        setPointsSource("local")
        return
      }

      const cloudTotal = await getUserPointsTotal(supabase)
      setTaskPoints(cloudTotal)
      setPointsSource("cloud")
    } catch (e: unknown) {
      const msg = String(
        e instanceof Error ? e.message : e ?? "load points failed",
      )
      console.warn("[ProfileScreen] load points failed:", msg)

      try {
        const localTotal = await getTotalPointsAllPets()
        setTaskPoints(localTotal)
        setPointsSource("local")
        setPointsError(t("profile.points.cloudFailedFallbackLocal"))
      } catch {
        setTaskPoints(0)
        setPointsSource(signedIn ? "cloud" : "local")
        setPointsError(t("profile.points.loadFailed"))
      }
    } finally {
      setPointsLoading(false)
    }
  }, [t])

  const loadSupabaseProfile = useCallback(async () => {
    setAuthLoading(true)
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes.user?.id ?? null
      setUserId(uid)

      if (!uid) {
        setProfile(null)
        setPostCount(0)
        setFriendCount(0)
        setUnreadMessages(0)
        setIncomingReqCount(0)
        return
      }

      const [
        { data: p, error: pErr },
        { count: pCount },
        { count: fCount },
        convs,
        incoming,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, avatar_url, bio, location_city")
          .eq("id", uid)
          .single(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq(
          "author_id",
          uid,
        ),
        supabase
          .from("friendships")
          .select("user_a", { count: "exact", head: true })
          .or(`user_a.eq.${uid},user_b.eq.${uid}`),
        fetchConversationSummaries(uid),
        fetchIncomingRequests(uid),
      ])

      if (!pErr) setProfile(p as ProfileRow)
      else setProfile(null)

      setPostCount(pCount ?? 0)
      setFriendCount(fCount ?? 0)

      const unreadTotal = (convs ?? []).reduce(
        (sum, r) => sum + (r.unread_count ?? 0),
        0,
      )
      setUnreadMessages(unreadTotal)
      setIncomingReqCount(incoming?.length ?? 0)
    } catch (err) {
      console.warn("[ProfileScreen] load supabase profile failed:", err)
      setUserId(null)
      setProfile(null)
      setPostCount(0)
      setFriendCount(0)
      setUnreadMessages(0)
      setIncomingReqCount(0)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  // ===== Screen focus =====
  useFocusEffect(
    useCallback(() => {
      let mounted = true
      ;(async () => {
        try {
          // local always
          const { localTotal } = await loadLocalStats()
          if (!mounted) return

          // show local until auth known
          setTaskPoints(localTotal)
          setPointsSource("local")
          setPointsLoading(true)
          setPointsError(null)

          // load auth/profile
          await loadSupabaseProfile()
          if (!mounted) return

          // decide points source based on latest auth
          const { data: userRes } = await supabase.auth.getUser()
          const signedIn = !!userRes.user?.id

          await loadCloudPointsIfSignedIn(signedIn)
        } catch (e) {
          console.warn("[ProfileScreen] focus load failed:", e)
          if (!mounted) return
          setPointsLoading(false)
          setPointsError(t("profile.points.loadFailed"))
        }
      })()

      return () => {
        mounted = false
      }
    }, [loadLocalStats, loadSupabaseProfile, loadCloudPointsIfSignedIn, t]),
  )

  // ===== Actions =====
  const onGoLogin = () => {
    navigation.navigate("Login" as never)
  }

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      await loadSupabaseProfile()
      await loadCloudPointsIfSignedIn(false)
    }
  }

  const actions: ActionItem[] = useMemo(
    () => [
      {
        key: "Friends",
        title: t("profile.actions.friends.title"),
        sub: t("profile.actions.friends.sub"),
        badge: badges.friendRequests,
        requiresAuth: true,
        onPress: () => navigation.navigate("ProfileFriends"),
      },
      {
        key: "Messages",
        title: t("profile.actions.messages.title"),
        sub: t("profile.actions.messages.sub"),
        badge: badges.messages,
        requiresAuth: true,
        onPress: () => navigation.navigate("ProfileMessages"),
      },
      {
        key: "MyPosts",
        title: t("profile.actions.myPosts.title"),
        sub: t("profile.actions.myPosts.sub"),
        requiresAuth: true,
        onPress: () => navigation.navigate("ProfileMyPosts"),
      },
      {
        key: "Resources",
        title: t("profile.actions.resources.title"),
        sub: t("profile.actions.resources.sub"),
        requiresAuth: false,
        onPress: () => navigation.navigate("MainTabs"),
      },
      {
        key: "Privacy",
        title: t("profile.actions.privacy.title"),
        sub: t("profile.actions.privacy.sub"),
        requiresAuth: true,
        onPress: () => navigation.navigate("Settings"),
      },
      {
        key: "Settings",
        title: t("profile.actions.settings.title"),
        sub: t("profile.actions.settings.sub"),
        requiresAuth: false,
        onPress: () => navigation.navigate("Settings"),
      },
      {
        key: "Membership",
        title: t("profile.actions.membership.title"),
        sub: t("profile.actions.membership.sub"),
        requiresAuth: true,
        onPress: () => navigation.navigate("Settings"),
      },
    ],
    [badges.friendRequests, badges.messages, navigation, t],
  )

  const pointsLabel = useMemo(() => {
    if (pointsLoading) return t("profile.stats.points")
    return pointsSource === "cloud"
      ? t("profile.stats.pointsCloud")
      : t("profile.stats.pointsLocal")
  }, [pointsLoading, pointsSource, t])

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View
          style={[styles.profileCard, {
            backgroundColor: palette.card,
            borderColor: palette.border,
          }]}
        >
          {authLoading
            ? (
              <View style={{ paddingVertical: 10, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 10, color: palette.subText }}>
                  {t("profile.loading")}
                </Text>
              </View>
            )
            : !isSignedIn
            ? (
              <>
                <Text style={[styles.name, { color: palette.text }]}>
                  {t("profile.signedOut.title")}
                </Text>
                <Text style={[styles.sub, { color: palette.subText }]}>
                  {t("profile.signedOut.subtitle")}
                </Text>

                <View style={styles.quickRow}>
                  <Pressable
                    style={[styles.primaryBtn, {
                      backgroundColor: palette.primary,
                    }]}
                    onPress={onGoLogin}
                  >
                    <Text
                      style={[styles.primaryBtnText, { color: palette.bg }]}
                    >
                      {t("profile.signedOut.login")}
                    </Text>
                  </Pressable>
                </View>
              </>
            )
            : (
              <>
                <Text style={[styles.name, { color: palette.text }]}>
                  {profile?.display_name ??
                    t("profile.signedIn.defaultUserName")}
                </Text>

                {!!profile?.location_city && (
                  <Text style={[styles.sub, { color: palette.subText }]}>
                    📍 {profile.location_city}
                  </Text>
                )}

                {/* 4 stats (2x2) */}
                <View style={styles.statsRow}>
                  <View
                    style={[styles.stat, {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }]}
                  >
                    <Text style={[styles.statNum, { color: palette.text }]}>
                      {postCount}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: palette.subText }]}
                    >
                      {t("profile.stats.posts")}
                    </Text>
                  </View>

                  <View
                    style={[styles.stat, {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }]}
                  >
                    <Text style={[styles.statNum, { color: palette.text }]}>
                      {friendCount}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: palette.subText }]}
                    >
                      {t("profile.stats.friends")}
                    </Text>
                  </View>

                  <View
                    style={[styles.stat, {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }]}
                  >
                    <Text style={[styles.statNum, { color: palette.text }]}>
                      {petCount}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: palette.subText }]}
                    >
                      {t("profile.stats.pets")}
                    </Text>
                  </View>

                  <View
                    style={[styles.stat, {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }]}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {pointsLoading ? <ActivityIndicator /> : null}
                      <Text style={[styles.statNum, { color: palette.text }]}>
                        {taskPoints}
                      </Text>
                    </View>
                    <Text
                      style={[styles.statLabel, { color: palette.subText }]}
                    >
                      {pointsLabel}
                    </Text>
                    {!!pointsError && (
                      <Text
                        style={[styles.pointsHint, { color: palette.subText }]}
                      >
                        {pointsError}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.quickRow}>
                  <Pressable
                    style={[styles.primaryBtn, {
                      backgroundColor: palette.primary,
                    }]}
                    onPress={() => navigation.navigate("PetSelect")}
                  >
                    <Text
                      style={[styles.primaryBtnText, { color: palette.bg }]}
                    >
                      {t("profile.buttons.goToCareProfile")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.secondaryBtn, {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    }]}
                    onPress={() => navigation.navigate("ProfileMatch")}
                  >
                    <Text
                      style={[styles.secondaryBtnText, {
                        color: palette.subText,
                      }]}
                    >
                      {t("profile.buttons.startMatching")}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.secondaryBtn, {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    }]}
                    onPress={onSignOut}
                  >
                    <Text
                      style={[styles.secondaryBtnText, {
                        color: palette.subText,
                      }]}
                    >
                      {t("profile.buttons.signOut")}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {t("profile.quickActions")}
          </Text>

          {actions.map((a) => {
            const disabled = !isSignedIn && !!a.requiresAuth

            return (
              <Pressable
                key={a.key}
                onPress={disabled ? undefined : a.onPress}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.listItem,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                  pressed && !disabled && styles.listItemPressed,
                  disabled && styles.listItemDisabled,
                ]}
              >
                <View style={styles.listItemRow}>
                  <View style={styles.listItemTextWrap}>
                    <Text
                      style={[
                        styles.listItemTitle,
                        { color: palette.text },
                        disabled && { color: palette.subText },
                      ]}
                    >
                      {a.title}
                    </Text>
                    {!!a.sub && (
                      <Text
                        style={[
                          styles.listItemSub,
                          { color: palette.subText },
                          disabled && styles.disabledSubText,
                        ]}
                      >
                        {a.sub}
                      </Text>
                    )}
                  </View>

                  {!!a.badge && a.badge > 0 && (
                    <View
                      style={[styles.badge, disabled && styles.badgeDisabled]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          disabled && styles.badgeTextDisabled,
                        ]}
                      >
                        {a.badge > 99 ? "99+" : String(a.badge)}
                      </Text>
                    </View>
                  )}
                </View>

                {disabled && (
                  <Text style={[styles.lockHint, { color: palette.subText }]}>
                    {t("profile.requiresLogin")}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },

  profileCard: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 22, fontWeight: "800" },
  sub: { marginTop: 6, lineHeight: 18 },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 12,
  },
  stat: {
    width: "48%",
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
  },
  statNum: { fontSize: 18, fontWeight: "800" },
  statLabel: { marginTop: 2, fontSize: 12 },
  pointsHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  quickRow: { marginTop: 14, gap: 10 },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: "center",
  },
  primaryBtnText: { fontWeight: "800" },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontWeight: "700" },

  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },

  listItem: {
    borderRadius: theme.radii.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.995 }],
  },

  listItemDisabled: {
    opacity: 0.45,
  },
  disabledSubText: {
    opacity: 0.9,
  },
  lockHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
  },

  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  listItemTextWrap: { flex: 1 },
  listItemTitle: { fontWeight: "800" },
  listItemSub: { marginTop: 6 },

  badge: {
    backgroundColor: theme.colors.critical,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
  },
  badgeText: { color: "white", fontSize: 12, fontWeight: "900" },
  badgeDisabled: {
    opacity: 0.6,
  },
  badgeTextDisabled: {
    opacity: 0.9,
  },
})
