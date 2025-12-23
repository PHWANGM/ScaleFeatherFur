// src/components/ProductCard.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

type Palette = {
  bg: string;
  card: string;
  text: string;
  subText: string;
  border: string;
  primary: string;
  link: string;
  linkBg: string;
  orange: string;
};

type ProductRow = {
  id: string;
  name: string;
  brand: string | null;
  tags: string | null;
  affiliate_url: string | null;
  region: string | null;

  // ✅ NEW
  image_url: string | null;
  description: string | null;

  created_at: string;
  updated_at: string;
};

export default function ProductCard({
  product,
  palette,
  onPress,
}: {
  product: ProductRow;
  palette: Palette;
  onPress?: (p: ProductRow) => void;
}) {
  const [imgError, setImgError] = useState(false);

  const fallbackImageUrl = useMemo(() => {
    const seed = encodeURIComponent(product.id || product.name || 'product');
    return `https://picsum.photos/seed/${seed}/120/120`;
  }, [product.id, product.name]);

  const imageUrl = useMemo(() => {
    const url = product.image_url?.trim();
    return url && url.length > 0 ? url : fallbackImageUrl;
  }, [product.image_url, fallbackImageUrl]);

  const { tagsText, previewText } = useMemo(() => {
    let tagsText = '';

    // tags: 支援 JSON array 或純字串
    if (product.tags) {
      try {
        const parsed = JSON.parse(product.tags);
        if (Array.isArray(parsed)) {
          tagsText = parsed.filter(x => typeof x === 'string').join(' · ');
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray((parsed as any).tags)) tagsText = (parsed as any).tags.join(' · ');
        } else if (typeof parsed === 'string') {
          tagsText = parsed;
        }
      } catch {
        tagsText = product.tags;
      }
    }

    // ✅ preview：優先 description，其次 fallback 組合字
    const desc = product.description?.trim();
    if (desc && desc.length > 0) {
      return { tagsText, previewText: desc };
    }

    const parts = [
      product.brand ? `品牌：${product.brand}` : null,
      product.region ? `地區：${product.region}` : null,
      tagsText ? `標籤：${tagsText}` : null,
    ].filter(Boolean);

    return {
      tagsText,
      previewText: parts.length > 0 ? parts.join('  ·  ') : '點進來看更多內容…',
    };
  }, [product.tags, product.brand, product.region, product.description]);

  const handlePress = async () => {
    if (product.affiliate_url) {
      try {
        const ok = await Linking.canOpenURL(product.affiliate_url);
        if (!ok) {
          Alert.alert('無法開啟連結', '這個連結格式可能不正確');
          return;
        }
        await Linking.openURL(product.affiliate_url);
        return;
      } catch {
        Alert.alert('無法開啟連結', '請稍後再試');
        return;
      }
    }

    onPress?.(product);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.thumbWrap,
            { backgroundColor: 'rgba(0,0,0,0.06)', borderColor: palette.border },
          ]}
        >
          {imgError ? (
            <View style={styles.thumbFallback}>
              <Feather name="image" size={18} color={palette.subText} />
            </View>
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumb}
              onError={() => setImgError(true)}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {product.name}
            </Text>

            {product.affiliate_url ? (
              <View style={[styles.badge, { backgroundColor: palette.linkBg }]}>
                <Text style={[styles.badgeText, { color: palette.link }]}>Link</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.preview, { color: palette.subText }]} numberOfLines={2}>
            {previewText}
          </Text>

          {tagsText ? (
            <Text style={[styles.tags, { color: palette.subText }]} numberOfLines={1}>
              {tagsText}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56 },
  thumbFallback: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800' },
  preview: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  tags: { marginTop: 6, fontSize: 12, opacity: 0.9 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
