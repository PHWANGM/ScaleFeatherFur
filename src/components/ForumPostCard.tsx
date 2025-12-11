// src/components/ForumPostCard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ForumPost = {
  id: string;
  userId: string;
  title: string;
  content: string;
  imageUrl?: string;
  productLink?: string;
  petType: string;      // 任意 species_key
  likes: number;
  createdAt: string;    // ISO string
};

type PaletteLike = {
  bg: string;
  card: string;
  text: string;
  subText: string;
  border: string;
  inputBg?: string;
  link: string;
  linkBg: string;
  [key: string]: any;
};

type Props = {
  post: ForumPost;
  palette: PaletteLike;
};

const ForumPostCard: React.FC<Props> = ({ post, palette }) => {
  const createdDateLabel = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString()
    : '剛剛';

  const badgeEmoji =
    post.petType === 'dog'
      ? '🐶'
      : post.petType === 'cat'
      ? '🐱'
      : '🐰';

  const inputBg = palette.inputBg ?? 'rgba(0,0,0,0.04)';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}
    >
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.avatarSmall,
            { marginRight: 10, borderColor: palette.border },
          ]}
        >
          <Image
            source={{
              uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${post.userId}`,
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </View>
        <View>
          <Text style={[styles.userName, { color: palette.text }]}>
            匿名鏟屎官
          </Text>
          <Text style={[styles.timeText, { color: palette.subText }]}>
            {createdDateLabel}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            { backgroundColor: inputBg, marginLeft: 'auto' },
          ]}
        >
          <Text style={[styles.badgeText, { color: palette.subText }]}>
            {badgeEmoji}
          </Text>
        </View>
      </View>

      {/* Post Image */}
      {post.imageUrl ? (
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {/* Post Content */}
      <View style={styles.cardBody}>
        <Text style={[styles.postTitle, { color: palette.text }]}>
          {post.title}
        </Text>
        <Text style={[styles.postContent, { color: palette.subText }]}>
          {post.content}
        </Text>

        {/* Product Link */}
        {post.productLink ? (
          <Pressable
            onPress={() => Linking.openURL(post.productLink!)}
            style={[styles.linkButton, { backgroundColor: palette.linkBg }]}
          >
            <Feather name="shopping-bag" size={14} color={palette.link} />
            <Text
              style={[styles.linkText, { color: palette.link }]}
              numberOfLines={1}
            >
              推薦好物：點擊查看產品
            </Text>
            <Feather
              name="external-link"
              size={12}
              color={palette.link}
              style={{ opacity: 0.6 }}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Action Footer（目前只有 UI，沒有寫入 likes） */}
      <View style={[styles.cardFooter, { borderTopColor: palette.border }]}>
        <Pressable style={styles.actionBtn}>
          <Feather name="heart" size={20} color={palette.subText} />
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <Feather name="message-circle" size={20} color={palette.subText} />
        </Pressable>
        <Pressable style={[styles.actionBtn, { marginLeft: 'auto' }]}>
          <Feather name="share-2" size={20} color={palette.subText} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Card Styles（從 PetForumScreen 抽出來）
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  userName: { fontSize: 14, fontWeight: '700' },
  timeText: { fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12 },
  postImage: { width: '100%', height: 260, backgroundColor: '#e5e5e5' },
  cardBody: { marginTop: 8 },
  postTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  postContent: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { marginRight: 20 },

  // Link Button
  linkButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  linkText: { fontSize: 12, flex: 1, fontWeight: '600' },
});

export default ForumPostCard;
