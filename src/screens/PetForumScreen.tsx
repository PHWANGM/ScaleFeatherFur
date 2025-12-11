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
} from '../lib/db/repos/forum.repo';

// ✅ 共用主題 Hook（跟 HomeScreen 一樣）
import { useThemeColors } from '../styles/themesColors';

// ✅ 發文畫面 component
import ForumCreatePost, {
  type ForumCreatePostInput,
} from '../components/ForumCreatePost';

// ✅ 貼文卡片 component
import ForumPostCard, {
  type ForumPost,
} from '../components/ForumPostCard';

// --- 型別定義（對應 UI，而非直接 DB Row） ---
// 直接使用 ForumPost 型別
type Post = ForumPost;

export default function PetForumScreen() {
  const { colors, isDark } = useThemeColors();
  const navigation = useNavigation<any>();

  // 🎨 palette：盡量跟 HomeScreen 風格一致，再加上 forum 需要的顏色
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

  const [currentView, setCurrentView] = useState<'feed' | 'create'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // 將 DB 的 ArticleRow -> UI 用的 Post
  const mapArticleToPost = useCallback((article: ArticleRow): Post => {
    let imageUrl: string | undefined;
    let productLink: string | undefined;
    let likes = 0;

    if (article.tags) {
      try {
        const parsed = JSON.parse(article.tags);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.imageUrl === 'string') imageUrl = parsed.imageUrl;
          if (typeof parsed.productLink === 'string')
            productLink = parsed.productLink;
          if (typeof parsed.likes === 'number') likes = parsed.likes;
        }
      } catch {
        // 非預期 JSON 結構就忽略
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

  // 載入貼文（從本地 DB）
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const articles = await getAllArticles();
      const mapped = articles.map(mapArticleToPost);
      mapped.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setPosts(mapped);
    } catch (e) {
      console.error('Load posts error', e);
      Alert.alert('錯誤', '載入貼文時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [mapArticleToPost]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // 建立貼文：把 UI 的欄位轉成 DB 的 article 資料
  const handleCreatePost = useCallback(
    async (input: ForumCreatePostInput) => {
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
    },
    []
  );

  const handleCreateSuccess = useCallback(() => {
    setCurrentView('feed');
    loadPosts();
  }, [loadPosts]);

  // --- Header：跟 HomeScreen 類似的 layout ---
  const renderHeader = () => (
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
          <MaterialCommunityIcons
            name="paw"
            size={20}
            color={palette.orange}
          />
        </View>
        <Text style={[styles.appTitle, { color: palette.text }]}>
          萌寵圈 · Forum
        </Text>
      </View>

      {/* 右側：切換 發文/列表，類似 HomeScreen 的設定鈕 */}
      <Pressable
        style={styles.iconBtn}
        onPress={() =>
          setCurrentView(prev => (prev === 'feed' ? 'create' : 'feed'))
        }
        hitSlop={10}
      >
        {currentView === 'feed' ? (
          <Feather
            name="edit-3"
            size={20}
            color={isDark ? '#d1d5db' : '#4b5563'}
          />
        ) : (
          <Feather
            name="x"
            size={20}
            color={isDark ? '#d1d5db' : '#4b5563'}
          />
        )}
      </Pressable>
    </View>
  );

  const renderPostItem: ListRenderItem<Post> = ({ item }) => (
    <ForumPostCard post={item} palette={palette} />
  );

  // Main Content Switcher（跟 HomeScreen 一樣，上面是 header，下面整頁內容）
  const renderContent = () => {
    if (loading && currentView === 'feed') {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: palette.subText }}>
            Loading from database…
          </Text>
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
              <Text style={{ color: palette.subText }}>
                目前還沒有貼文，快來搶頭香！
              </Text>
            </View>
          }
        />
      );
    }

    if (currentView === 'create') {
      return (
        <ForumCreatePost
          palette={palette}
          onSuccess={handleCreateSuccess}
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

  // Header 跟 HomeScreen 一致
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

  content: { padding: 16, paddingBottom: 32 },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
