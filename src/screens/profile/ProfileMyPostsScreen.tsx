// src/screens/profile/ProfileMyPostsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useTranslation } from "react-i18next"

import { supabase } from "../../lib/supabase" // ✅ 依你專案實際路徑調整
import { getAuthedUserId } from "../../lib/supabase/repos/profile.repo"

import ForumPostCard, { type ForumPost } from "../../components/ForumPostCard"

// 你 posts.repo.ts 的 PostsFeedItem 結構（這裡只取畫面會用到的欄位）
type MyPostsRow = {
  id: string
  author_id: string
  type: string
  title: string | null
  body_md: string
  species_key: string | null
  created_at: string

  // enrich (可有可無)
  likes_count?: number

  // media
  image_url?: string | null
}

const paletteLight = {
  bg: "#ffffff",
  card: "#ffffff",
  text: "#111111",
  subText: "#555555",
  border: "#eeeeee",
  inputBg: "rgba(0,0,0,0.04)",
  link: "#0b5cff",
  linkBg: "rgba(11,92,255,0.10)",
}

// 讓 UI 的 petType badge 不會全部變 🐰（ForumPostCard 目前只判 dog/cat/else）
function mapSpeciesToPetType(speciesKey?: string | null) {
  const s = (speciesKey ?? "").toLowerCase()
  if (s.includes("dog")) return "dog"
  if (s.includes("cat")) return "cat"
  return speciesKey ?? "other"
}

/**
 * 從 posts + post_media(最新一張) + post_likes(count)
 * 拉回「我的貼文」(依 created_at desc)
 */
async function fetchMyPosts(myId: string, limit = 50): Promise<MyPostsRow[]> {
  // 1) posts
  const { data: posts, error: pErr } = await supabase
    .from("posts")
    .select("id, author_id, type, title, body_md, species_key, created_at")
    .eq("author_id", myId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (pErr) throw pErr

  const rows = (posts ?? []) as MyPostsRow[]
  if (rows.length === 0) return []

  const postIds = rows.map((r) => r.id)

  // 2) likes count（two-step）
  const { data: likesRows, error: lErr } = await supabase
    .from("post_likes")
    .select("post_id")
    .in("post_id", postIds)

  if (lErr) console.warn("[fetchMyPosts] likes error", lErr)

  const likeCountMap = new Map<string, number>()
  const likeRows = (likesRows ?? []) as { post_id: string }[]
  likeRows.forEach((lr) => {
    const pid = lr.post_id
    likeCountMap.set(pid, (likeCountMap.get(pid) ?? 0) + 1)
  })

  // 3) media（每篇只取最新一張）
  const { data: mediaRows, error: mErr } = await supabase
    .from("post_media")
    .select("post_id, storage_path, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false })

  if (mErr) console.warn("[fetchMyPosts] post_media error", mErr)

  const latestMediaMap = new Map<string, { storage_path: string }>()
  const latestMediaRows = (mediaRows ?? []) as {
    post_id: string
    storage_path: string
  }[]
  latestMediaRows.forEach((mr) => {
    if (!latestMediaMap.has(mr.post_id)) {
      latestMediaMap.set(mr.post_id, {
        storage_path: mr.storage_path,
      })
    }
  })

  // storage path -> public url（你的 bucket 是 post-media）
  const BUCKET = "post-media"
  const toPublicUrl = (storagePath: string) =>
    supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl

  return rows.map((r) => {
    const likes_count = likeCountMap.get(r.id) ?? 0
    const media = latestMediaMap.get(r.id)
    const image_url = media?.storage_path
      ? toPublicUrl(media.storage_path)
      : null

    return {
      ...r,
      likes_count,
      image_url,
    }
  })
}

export default function ProfileMyPostsScreen() {
  const { t } = useTranslation()

  const [myId, setMyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [posts, setPosts] = useState<MyPostsRow[]>([])

  // ✅ i18n fallback helpers（依語系顯示）
  const safeTitle = useCallback(
    (row: MyPostsRow) => {
      return row.title && row.title.trim().length > 0
        ? row.title
        : t("myPosts.fallback.noTitle")
    },
    [t],
  )

  const safePreview = useCallback(
    (row: MyPostsRow) => {
      const txt = (row.body_md ?? "").trim()
      if (!txt) return t("myPosts.fallback.noContent")
      return txt.length > 120 ? `${txt.slice(0, 120)}…` : txt
    },
    [t],
  )

  // 把 DB row 轉成 ForumPostCard 需要的型別（依語系 fallback）
  const toForumPost = useCallback(
    (row: MyPostsRow): ForumPost => {
      return {
        id: row.id,
        userId: row.author_id,
        title: safeTitle(row),
        content: safePreview(row),
        imageUrl: row.image_url ?? undefined,
        productLink: undefined,
        petType: mapSpeciesToPetType(row.species_key),
        likes: row.likes_count ?? 0,
        createdAt: row.created_at,
      }
    },
    [safePreview, safeTitle],
  )

  const forumPosts = useMemo(() => posts.map(toForumPost), [posts, toForumPost])
  const empty = useMemo(() => !loading && forumPosts.length === 0, [
    loading,
    forumPosts.length,
  ])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const uid = await getAuthedUserId()
      setMyId(uid)

      if (!uid) {
        setPosts([])
        return
      }

      const rows = await fetchMyPosts(uid, 80)
      setPosts(rows)
    } catch (e: unknown) {
      console.warn("[ProfileMyPostsScreen] load error", e)
      Alert.alert(
        t("myPosts.alerts.errorTitle"),
        e instanceof Error ? e.message : t("myPosts.alerts.loadFailed"),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t("myPosts.loading")}</Text>
      </View>
    )
  }

  if (!myId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t("myPosts.title")}</Text>
        <Text style={styles.muted}>{t("myPosts.signInToUse")}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("myPosts.title")}</Text>

      <FlatList
        data={forumPosts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <ForumPostCard post={item} palette={paletteLight} />
        )}
        ListEmptyComponent={empty
          ? (
            <View style={{ paddingTop: 16 }}>
              <Text style={styles.muted}>{t("myPosts.empty.line1")}</Text>
              <Text style={styles.muted}>{t("myPosts.empty.line2")}</Text>
            </View>
          )
          : null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  title: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  muted: { color: "#777", marginTop: 6 },
})
