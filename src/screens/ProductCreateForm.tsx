// src/components/ProductCreateForm.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

type Palette = {
  bg: string;
  card: string;
  text: string;
  subText: string;
  border: string;
  primary: string;
  inputBg: string;
  link: string;
  linkBg: string;
};

export type ProductCreateInput = {
  name: string;
  brand?: string | null;
  tags?: string | null; // JSON array string
  affiliate_url?: string | null;
  region?: string | null;

  // ✅ image_url 現在改成「本機照片 URI」(file://...) 或 null
  image_url?: string | null;
  description?: string | null;
};

export default function ProductCreateForm({
  palette,
  onCreateProduct,
  onSuccess,
  onCancel,
}: {
  palette: Palette;
  onCreateProduct: (input: ProductCreateInput) => Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [region, setRegion] = useState('TW');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null); // ✅ NEW: 拍照/相簿 uri
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState(''); // ex: UVB, sulcata, lamp
  const [submitting, setSubmitting] = useState(false);

  const tagsJson = useMemo(() => {
    const arr = tagsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (arr.length === 0) return null;
    return JSON.stringify(arr);
  }, [tagsRaw]);

  const normalizePickerResult = (result: any): string | null => {
    // 新版：result.canceled + result.assets[0].uri
    if (result && typeof result === 'object') {
      if (result.canceled === true) return null;
      if (Array.isArray(result.assets) && result.assets[0]?.uri) {
        return result.assets[0].uri as string;
      }
      // 舊版：result.cancelled + result.uri
      if (result.cancelled === true) return null;
      if (typeof result.uri === 'string') return result.uri;
    }
    return null;
  };

  const ensureLibraryPermission = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相簿權限', '請允許相簿權限以選擇照片');
      return false;
    }
    return true;
  };

  const ensureCameraPermission = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('需要相機權限', '請允許相機權限以拍攝照片');
      return false;
    }
    return true;
  };

  const handlePickFromLibrary = async () => {
    try {
      const ok = await ensureLibraryPermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
        aspect: [1, 1],
      });

      const uri = normalizePickerResult(result);
      if (uri) setImageUri(uri);
    } catch (e) {
      console.error(e);
      Alert.alert('選擇照片失敗', '請稍後再試');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
        aspect: [1, 1],
      });

      const uri = normalizePickerResult(result);
      if (uri) setImageUri(uri);
    } catch (e) {
      console.error(e);
      Alert.alert('拍照失敗', '請稍後再試');
    }
  };

  const handleSubmit = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('請填寫商品名稱');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateProduct({
        name: n,
        brand: brand.trim() || null,
        region: region.trim() || null,
        affiliate_url: affiliateUrl.trim() || null,
        tags: tagsJson,
        image_url: imageUri || null,
        description: description.trim() || null,
      });
      onSuccess();
    } catch (e) {
      console.error(e);
      Alert.alert('錯誤', '新增商品失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.title, { color: palette.text }]}>新增商品</Text>

          <Text style={[styles.label, { color: palette.subText }]}>商品名稱 *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="例如：Arcadia T5 UVB 12%"
            placeholderTextColor={palette.subText}
            style={[
              styles.input,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <Text style={[styles.label, { color: palette.subText }]}>品牌</Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder="例如：Arcadia"
            placeholderTextColor={palette.subText}
            style={[
              styles.input,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <Text style={[styles.label, { color: palette.subText }]}>地區</Text>
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder="TW / US"
            placeholderTextColor={palette.subText}
            style={[
              styles.input,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <Text style={[styles.label, { color: palette.subText }]}>Affiliate URL</Text>
          <TextInput
            value={affiliateUrl}
            onChangeText={setAffiliateUrl}
            placeholder="https://..."
            placeholderTextColor={palette.subText}
            autoCapitalize="none"
            style={[
              styles.input,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          {/* ✅ NEW: 拍照/相簿上傳 */}
          <Text style={[styles.label, { color: palette.subText }]}>商品圖片</Text>

          <View style={styles.imageRow}>
            <View
              style={[
                styles.imagePreviewWrap,
                { backgroundColor: palette.inputBg, borderColor: palette.border },
              ]}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Feather name="image" size={18} color={palette.subText} />
                  <Text style={[styles.imagePlaceholderText, { color: palette.subText }]}>
                    尚未選擇
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1, gap: 10 }}>
              <Pressable
                onPress={handleTakePhoto}
                disabled={submitting}
                style={[
                  styles.smallBtn,
                  { borderColor: palette.border, backgroundColor: 'transparent' },
                ]}
              >
                <Text style={[styles.smallBtnText, { color: palette.text }]}>拍照</Text>
              </Pressable>

              <Pressable
                onPress={handlePickFromLibrary}
                disabled={submitting}
                style={[
                  styles.smallBtn,
                  { borderColor: palette.border, backgroundColor: 'transparent' },
                ]}
              >
                <Text style={[styles.smallBtnText, { color: palette.text }]}>從相簿選擇</Text>
              </Pressable>

              {imageUri ? (
                <Pressable
                  onPress={() => setImageUri(null)}
                  disabled={submitting}
                  style={[
                    styles.smallBtn,
                    { borderColor: palette.border, backgroundColor: 'transparent' },
                  ]}
                >
                  <Text style={[styles.smallBtnText, { color: palette.subText }]}>移除圖片</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <Text style={[styles.label, { color: palette.subText }]}>簡介</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="例如：高輸出 UVB T5 燈管，適合日行性龜/蜥蜴..."
            placeholderTextColor={palette.subText}
            multiline
            style={[
              styles.input,
              styles.inputMultiline,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <Text style={[styles.label, { color: palette.subText }]}>Tags（逗號分隔）</Text>
          <TextInput
            value={tagsRaw}
            onChangeText={setTagsRaw}
            placeholder="UVB, sulcata, lamp"
            placeholderTextColor={palette.subText}
            style={[
              styles.input,
              { backgroundColor: palette.inputBg, borderColor: palette.border, color: palette.text },
            ]}
          />

          <View style={styles.btnRow}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, { borderColor: palette.border }]}
              disabled={submitting}
            >
              <Text style={[styles.btnText, { color: palette.subText }]}>取消</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              style={[
                styles.btn,
                { backgroundColor: palette.linkBg, borderColor: palette.linkBg },
              ]}
              disabled={submitting}
            >
              <Text style={[styles.btnText, { color: palette.link }]}>
                {submitting ? '新增中…' : '新增'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: palette.subText }]}>
            * 圖片會以本機 URI（file://...）存到 image_url 欄位；若你之後要跨裝置同步，建議上傳到雲端再存 URL。
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  label: { marginTop: 10, marginBottom: 6, fontSize: 12, fontWeight: '700' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  imageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  imagePreviewWrap: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imagePreview: {
    width: 96,
    height: 96,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imagePlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  smallBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '800' },
  hint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.9,
  },
});
