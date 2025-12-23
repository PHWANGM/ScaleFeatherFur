// src/screens/PetForumScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// ✅ 本地資料庫 forum repo
import {
  getAllArticles,
  createArticle,
  type ArticleRow,
  getAllProducts,
  createProduct,
  type ProductRow,
} from '../lib/db/repos/forum.repo';

// ✅ 共用主題 Hook（跟 HomeScreen 一樣）
import { useThemeColors } from '../styles/themesColors';

// ✅ 發文畫面 component
import ForumCreatePost, { type ForumCreatePostInput } from '../components/ForumCreatePost';

// ✅ 貼文卡片 component
import ForumPostCard, { type ForumPost } from '../components/ForumPostCard';

// ✅ 商品卡片 & 新增商品表單
import ProductCard from '../components/ProductCard';
import ProductCreateForm, { type ProductCreateInput } from './ProductCreateForm';

// --- 型別定義（對應 UI，而非直接 DB Row） ---
type Post = ForumPost;

export default function PetForumScreen() {
  const { colors, isDark } = useThemeColors();
  const navigation = useNavigation<any>();

  // 🎨 palette：盡量跟 HomeScreen 風格一致，再加上 forum/product 需要的顏色
  const palette = useMemo(() => {
    const base = {
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? '#38e07b',
    };
    return {
      ...base,
      inputBg:
        (colors as any).inputBg ??
        (isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)'),
      link: (colors as any).link ?? base.primary,
      linkBg:
        (colors as any).linkBg ??
        (isDark ? 'rgba(56,224,123,0.25)' : 'rgba(56,224,123,0.08)'),
      orange: (colors as any).orange ?? '#f97316',
    };
  }, [colors, isDark]);

  // ✅ 顯示模式：Forum / Product
  const [mode, setMode] = useState<'forum' | 'product'>('forum');

  // ✅ feed / create（兩個模式共用）
  const [currentView, setCurrentView] = useState<'feed' | 'create'>('feed');

  // Forum 資料
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Product 資料
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // --- ArticleRow -> Post ---
  const mapArticleToPost = useCallback((article: ArticleRow): Post => {
    let imageUrl: string | undefined;
    let productLink: string | undefined;
    let likes = 0;

    if (article.tags) {
      try {
        const parsed = JSON.parse(article.tags);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.imageUrl === 'string') imageUrl = parsed.imageUrl;
          if (typeof parsed.productLink === 'string') productLink = parsed.productLink;
          if (typeof parsed.likes === 'number') likes = parsed.likes;
        }
      } catch {
        // ignore
      }
    }

    const petType = article.species_key || 'other';

    return {
      id: article.id,
      userId: 'local-demo-user',
      title: article.title,
      content: article.body_md,
      petType,
      createdAt: article.created_at,
      imageUrl,
      productLink,
      likes,
    };
  }, []);

  // --- Load Forum Posts ---
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const articles = await getAllArticles();
      const mapped = articles.map(mapArticleToPost);
      mapped.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPosts(mapped);
    } catch (e) {
      console.error('Load posts error', e);
      Alert.alert('錯誤', '載入貼文時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [mapArticleToPost]);

  // --- Load Products ---
  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const rows = await getAllProducts();
      rows.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setProducts(rows);
    } catch (e) {
      console.error('Load products error', e);
      Alert.alert('錯誤', '載入商品時發生錯誤');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // 初次進入：載入 forum
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // 切到 product：載入商品
  useEffect(() => {
    if (mode === 'product') loadProducts();
  }, [mode, loadProducts]);

  // --- Create Forum Post ---
  const handleCreatePost = useCallback(async (input: ForumCreatePostInput) => {
    const key = input.speciesKey || 'other';

    const finalImageUrl =
      input.imageUrl && input.imageUrl.trim().length > 0
        ? input.imageUrl.trim()
        : `https://source.unsplash.com/random/800x800/?${key}`;

    const tagsPayload = {
      tags: [] as string[],
      imageUrl: finalImageUrl,
      productLink: input.productLink || null,
      likes: 0,
    };

    await createArticle({
      title: input.title,
      body_md: input.content,
      species_key: key,
      tags: JSON.stringify(tagsPayload),
    });
  }, []);

  // --- Create Product (✅ 支援 image_url / description) ---
  const handleCreateProduct = useCallback(async (input: ProductCreateInput) => {
    await createProduct({
      name: input.name,
      brand: input.brand ?? null,
      tags: input.tags ?? null,
      affiliate_url: input.affiliate_url ?? null,
      region: input.region ?? null,

      // ✅ NEW
      image_url: input.image_url ?? null,
      description: input.description ?? null,
    });
  }, []);

  const handleCreateSuccessForum = useCallback(() => {
    setCurrentView('feed');
    loadPosts();
  }, [loadPosts]);

  const handleCreateSuccessProduct = useCallback(() => {
    setCurrentView('feed');
    loadProducts();
  }, [loadProducts]);

  const switchMode = useCallback((next: 'forum' | 'product') => {
    setMode(next);
    setCurrentView('feed');
  }, []);

  // --- Header ---
  const renderHeader = () => (
    <View
      style={[
        styles.headerWrap,
        { backgroundColor: palette.bg, borderBottomColor: palette.border },
      ]}
    >
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        {/* 左側預留空間（對齊 HomeScreen） */}
        <View style={{ width: 48 }} />

        {/* 中間：App 標題 + paw icon */}
        <View style={styles.headerTitleRow}>
          <View
            style={[
              styles.headerIconBox,
              { backgroundColor: 'rgba(249,115,22,0.12)' },
            ]}
          >
            <MaterialCommunityIcons name="paw" size={20} color={palette.orange} />
          </View>
          <Text style={[styles.appTitle, { color: palette.text }]}>
            {mode === 'forum' ? '萌寵圈 · Forum' : '萌寵圈 · Products'}
          </Text>
        </View>

        {/* 右側：Forum => edit-3/x；Product => plus/x */}
        <Pressable
          style={styles.iconBtn}
          onPress={() => setCurrentView(prev => (prev === 'feed' ? 'create' : 'feed'))}
          hitSlop={10}
        >
          {currentView === 'feed' ? (
            <Feather
              name={mode === 'forum' ? 'edit-3' : 'plus'}
              size={20}
              color={isDark ? '#d1d5db' : '#4b5563'}
            />
          ) : (
            <Feather name="x" size={20} color={isDark ? '#d1d5db' : '#4b5563'} />
          )}
        </Pressable>
      </View>

      {/* ✅ Forum / Product 切換 Tag */}
      <View style={[styles.modeTabsRow, { backgroundColor: palette.bg }]}>
        <Pressable
          onPress={() => switchMode('forum')}
          style={[
            styles.modeTab,
            {
              backgroundColor: mode === 'forum' ? palette.linkBg : 'transparent',
              borderColor: palette.border,
            },
          ]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === 'forum' ? palette.link : palette.subText },
            ]}
          >
            Forum
          </Text>
        </Pressable>

        <Pressable
          onPress={() => switchMode('product')}
          style={[
            styles.modeTab,
            {
              backgroundColor: mode === 'product' ? palette.linkBg : 'transparent',
              borderColor: palette.border,
            },
          ]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: mode === 'product' ? palette.link : palette.subText },
            ]}
          >
            Product
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderPostItem: ListRenderItem<Post> = ({ item }) => (
    <ForumPostCard post={item} palette={palette} />
  );

  const renderProductItem: ListRenderItem<ProductRow> = ({ item }) => (
    <ProductCard product={item} palette={palette} />
  );

  // --- Content ---
  const renderContent = () => {
    // ✅ Product 模式
    if (mode === 'product') {
      if (currentView === 'create') {
        return (
          <ProductCreateForm
            palette={palette as any}
            onCreateProduct={handleCreateProduct}
            onSuccess={handleCreateSuccessProduct}
            onCancel={() => setCurrentView('feed')}
          />
        );
      }

      if (loadingProducts) {
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: palette.subText }}>Loading products…</Text>
          </View>
        );
      }

      return (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: palette.subText }}>目前還沒有商品資料（products）。</Text>
            </View>
          }
        />
      );
    }

    // ✅ Forum 模式
    if (loading && currentView === 'feed') {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: palette.subText }}>Loading from database…</Text>
        </View>
      );
    }

    if (currentView === 'feed') {
      return (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={{ color: palette.subText }}>目前還沒有貼文，快來搶頭香！</Text>
            </View>
          }
        />
      );
    }

    if (currentView === 'create') {
      return (
        <ForumCreatePost
          palette={palette}
          onSuccess={handleCreateSuccessForum}
          onCreatePost={handleCreatePost}
          onAddSpecies={() => navigation.navigate('SpeciesEditor')}
        />
      );
    }

    return null;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {renderHeader()}
      {renderContent()}
    </SafeAreaView>
  );
}

/* 🧱 Styles：比照 HomeScreen 的結構，只保留非卡片的部分 */
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ✅ mode tabs
  modeTabsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
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
    fontWeight: '700',
  },

  content: { padding: 16, paddingBottom: 32 },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
