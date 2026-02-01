// src/screens/PetForumScreen.tsx
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useTranslation } from "react-i18next"

// ✅ Supabase forum posts repo
import {
  createPostWithImage,
  fetchPostsFeed,
} from "../lib/supabase/repos/posts.repo"

// ✅ Local DB product repo
import {
  createProduct,
  getAllProducts,
  type ProductRow,
} from "../lib/db/repos/forum.repo"

// ✅ Theme hook
import { useThemeColors } from "../styles/themesColors"

// ✅ Screens/components
import ForumCreatePost, {
  type ForumCreatePostInput,
} from "../components/ForumCreatePost"
import ForumPostCard, { type ForumPost } from "../components/ForumPostCard"
import ProductCard from "../components/ProductCard"
import ProductCreateForm, { type ProductCreateInput } from "./ProductCreateForm"

// --- UI Type ---
type Post = ForumPost

type Palette = {
  bg: string
  card: string
  text: string
  subText: string
  border: string
  primary: string
  inputBg: string
  link: string
  linkBg: string
  orange: string
}

export default function PetForumScreen() {
  const { t } = useTranslation()
  const { colors, isDark } = useThemeColors()
  const navigation = useNavigation()

  // 🎨 palette
  const palette = useMemo<Palette>(() => {
    const extraColors = colors as Record<string, string | undefined>
    const base = {
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? extraColors.textDim ?? "#97A3B6",
      border: colors.border,
      primary: colors.primary ?? "#38e07b",
    }
    return {
      ...base,
      inputBg: extraColors.inputBg ??
        (isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.9)"),
      link: extraColors.link ?? base.primary,
      linkBg: extraColors.linkBg ??
        (isDark ? "rgba(56,224,123,0.25)" : "rgba(56,224,123,0.08)"),
      orange: extraColors.orange ?? "#f97316",
    }
  }, [colors, isDark])

  // ✅ Modes: Forum / Product
  const [mode, setMode] = useState<"forum" | "product">("forum")

  // ✅ Views: Feed / Create
  const [currentView, setCurrentView] = useState<"feed" | "create">("feed")

  // Forum (Supabase)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  // Product (Local DB)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // --- Load Forum Posts ---
  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const feed = await fetchPostsFeed({ limit: 50 })

      const mapped: Post[] = feed.map((p) => {
        const petType = p.species_key || "other"

        const imageUrl = p.image_url && p.image_url.length > 0
          ? p.image_url
          : `https://source.unsplash.com/random/800x800/?${petType}`

        return {
          id: p.id,
          userId: p.author_id,
          title: p.title ?? t("forum.post.noTitle"),
          content: p.body_md,
          petType,
          createdAt: p.created_at,
          imageUrl,
          productLink: undefined,
          likes: p.likes_count ?? 0,
        }
      })

      setPosts(mapped)
    } catch (e) {
      console.error("Load posts error", e)
      Alert.alert(t("common.error"), t("forum.errors.loadPosts"))
    } finally {
      setLoading(false)
    }
  }, [t])

  // --- Load Products ---
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const rows = await getAllProducts()
      rows.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setProducts(rows)
    } catch (e) {
      console.error("Load products error", e)
      Alert.alert(t("common.error"), t("forum.errors.loadProducts"))
    } finally {
      setLoadingProducts(false)
    }
  }, [t])

  // initial: load forum
  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // when switch to product: load products
  useEffect(() => {
    if (mode === "product") loadProducts()
  }, [mode, loadProducts])

  // --- Create Forum Post ---
  const handleCreatePost = useCallback(async (input: ForumCreatePostInput) => {
    const key = input.speciesKey || "other"
    const fallbackUrl = `https://source.unsplash.com/random/900x900/?${key},pet`

    await createPostWithImage({
      type: "general",
      title: input.title,
      body_md: input.content,
      species_key: key,
      imageUri: input.imageUrl ?? null,
      fallbackUrl,
    })
  }, [])

  // --- Create Product ---
  const handleCreateProduct = useCallback(async (input: ProductCreateInput) => {
    await createProduct({
      name: input.name,
      brand: input.brand ?? null,
      tags: input.tags ?? null,
      affiliate_url: input.affiliate_url ?? null,
      region: input.region ?? null,
      image_url: input.image_url ?? null,
      description: input.description ?? null,
    })
  }, [])

  const handleCreateSuccessForum = useCallback(() => {
    setCurrentView("feed")
    loadPosts()
  }, [loadPosts])

  const handleCreateSuccessProduct = useCallback(() => {
    setCurrentView("feed")
    loadProducts()
  }, [loadProducts])

  const switchMode = useCallback((next: "forum" | "product") => {
    setMode(next)
    setCurrentView("feed")
  }, [])

  // --- Header ---
  const renderHeader = () => (
    <View
      style={[
        styles.headerWrap,
        { backgroundColor: palette.bg, borderBottomColor: palette.border },
      ]}
    >
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <View style={{ width: 48 }} />

        <View style={styles.headerTitleRow}>
          <View
            style={[styles.headerIconBox, {
              backgroundColor: "rgba(249,115,22,0.12)",
            }]}
          >
            <MaterialCommunityIcons
              name="paw"
              size={20}
              color={palette.orange}
            />
          </View>
          <Text style={[styles.appTitle, { color: palette.text }]}>
            {mode === "forum"
              ? t("forum.header.forumTitle")
              : t("forum.header.productsTitle")}
          </Text>
        </View>

        <Pressable
          style={styles.iconBtn}
          onPress={() =>
            setCurrentView((prev) => (prev === "feed" ? "create" : "feed"))}
          hitSlop={10}
        >
          {currentView === "feed"
            ? (
              <Feather
                name={mode === "forum" ? "edit-3" : "plus"}
                size={20}
                color={isDark ? "#d1d5db" : "#4b5563"}
              />
            )
            : (
              <Feather
                name="x"
                size={20}
                color={isDark ? "#d1d5db" : "#4b5563"}
              />
            )}
        </Pressable>
      </View>

      {/* ✅ Mode tabs */}
      <View style={[styles.modeTabsRow, { backgroundColor: palette.bg }]}>
        <Pressable
          onPress={() => switchMode("forum")}
          style={[
            styles.modeTab,
            {
              backgroundColor: mode === "forum"
                ? palette.linkBg
                : "transparent",
              borderColor: palette.border,
            },
          ]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === "forum" ? palette.link : palette.subText },
            ]}
          >
            {t("forum.tabs.forum")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => switchMode("product")}
          style={[
            styles.modeTab,
            {
              backgroundColor: mode === "product"
                ? palette.linkBg
                : "transparent",
              borderColor: palette.border,
            },
          ]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === "product" ? palette.link : palette.subText },
            ]}
          >
            {t("forum.tabs.products")}
          </Text>
        </Pressable>
      </View>
    </View>
  )

  const renderPostItem: ListRenderItem<Post> = ({ item }) => (
    <ForumPostCard post={item} palette={palette} />
  )
  const renderProductItem: ListRenderItem<ProductRow> = ({ item }) => (
    <ProductCard product={item} palette={palette} />
  )

  // --- Content ---
  const renderContent = () => {
    // ✅ Product mode
    if (mode === "product") {
      if (currentView === "create") {
        return (
          <ProductCreateForm
            palette={palette}
            onCreateProduct={handleCreateProduct}
            onSuccess={handleCreateSuccessProduct}
            onCancel={() => setCurrentView("feed")}
          />
        )
      }

      if (loadingProducts) {
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: palette.subText }}>
              {t("forum.loading.products")}
            </Text>
          </View>
        )
      }

      return (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: palette.subText }}>
                {t("forum.empty.products")}
              </Text>
            </View>
          }
        />
      )
    }

    // ✅ Forum mode
    if (loading && currentView === "feed") {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: palette.subText }}>
            {t("forum.loading.supabase")}
          </Text>
        </View>
      )
    }

    if (currentView === "feed") {
      return (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onRefresh={loadPosts}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: palette.subText }}>
                {t("forum.empty.posts")}
              </Text>
            </View>
          }
        />
      )
    }

    if (currentView === "create") {
      return (
        <ForumCreatePost
          palette={palette}
          onSuccess={handleCreateSuccessForum}
          onCreatePost={handleCreatePost}
          onAddSpecies={() => navigation.navigate("SpeciesEditor")}
        />
      )
    }

    return null
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right"]}
    >
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  appTitle: { fontSize: 18, fontWeight: "700" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  modeTabsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 10,
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "700",
  },

  content: { padding: 16, paddingBottom: 32 },

  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
})
