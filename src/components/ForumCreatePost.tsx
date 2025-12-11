// src/components/ForumCreatePost.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import PetSpeciesDropdown from './PetSpeciesDropdown';
import { useImagePicker } from '../lib/ui/useImagePicker';

type PaletteLike = {
  bg: string;
  card: string;
  text: string;
  subText: string;
  border: string;
  primary: string;
  inputBg?: string;
  [key: string]: any;
};

export type ForumCreatePostInput = {
  title: string;
  content: string;
  speciesKey: string;
  imageUrl?: string;     // 這裡會塞「相簿 / 相機」選到的檔案 URI 或遠端連結
  productLink?: string;
};

export type ForumCreatePostProps = {
  palette: PaletteLike;
  onSuccess: () => void;
  onCreatePost: (input: ForumCreatePostInput) => Promise<void>;
  onAddSpecies: () => void;
};

const ForumCreatePost: React.FC<ForumCreatePostProps> = ({
  palette,
  onSuccess,
  onCreatePost,
  onAddSpecies,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [productLink, setProductLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 🔄 用 speciesKey + 下拉式 component
  const [speciesKey, setSpeciesKey] = useState('dog');

  // 📷 新增：圖片 / short 媒體 URI（相簿或相機）
  const [mediaUri, setMediaUri] = useState<string>('');

  const { pickFromLibrary, takePhoto } = useImagePicker();

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onCreatePost({
        title: title.trim(),
        content: content.trim(),
        speciesKey,
        imageUrl: mediaUri.trim(),          // 將媒體 URI 傳出去
        productLink: productLink.trim(),
      });
      onSuccess();
    } catch (e: any) {
      console.error(e);
      Alert.alert('錯誤', e?.message ?? '無法發布貼文');
    } finally {
      setSubmitting(false);
    }
  };

  const inputBg = palette.inputBg ?? 'rgba(0,0,0,0.04)';

  const handlePickFromLibrary = async () => {
    try {
      const uri = await pickFromLibrary();
      if (uri) setMediaUri(uri);
    } catch (err) {
      console.error(err);
      Alert.alert('錯誤', '無法開啟相簿');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const uri = await takePhoto();
      if (uri) setMediaUri(uri);
    } catch (err) {
      console.error(err);
      Alert.alert('錯誤', '無法開啟相機');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* 寵物物種：下拉式 component */}
            <PetSpeciesDropdown
              palette={{
                inputBg,
                border: palette.border,
                text: palette.text,
                subText: palette.subText,
                link: palette.primary,
              }}
              value={speciesKey}
              onChange={setSpeciesKey}
              onAddSpecies={onAddSpecies}
            />

            <Text style={[styles.label, { color: palette.subText }]}>
              標題
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, color: palette.text },
              ]}
              placeholder="例如：週末的公園散步"
              placeholderTextColor={palette.subText}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: palette.subText }]}>
              內容
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  color: palette.text,
                  height: 100,
                  textAlignVertical: 'top',
                },
              ]}
              placeholder="分享一下你家毛孩的趣事吧..."
              placeholderTextColor={palette.subText}
              multiline
              value={content}
              onChangeText={setContent}
            />

            {/* 📷 圖片 / Short 區塊：相簿 or 相機，上傳媒體 */}
            <Text style={[styles.label, { color: palette.subText }]}>
              圖片 / Short (選填)
            </Text>
            <View style={[styles.mediaCard, { backgroundColor: inputBg }]}>
              {mediaUri ? (
                // 這裡先用 Image 做預覽：若選到影片也只是顯示失敗圖示（之後可改用 expo-av）
                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
              ) : (
                <View style={styles.mediaPlaceholder}>
                  <Text style={{ color: palette.subText, fontSize: 32 }}>📷</Text>
                  <Text
                    style={{
                      color: palette.subText,
                      marginTop: 4,
                      fontSize: 12,
                    }}
                  >
                    尚未選擇圖片或短片
                  </Text>
                </View>
              )}

              <View style={styles.mediaButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.mediaButton,
                    { borderColor: palette.primary },
                  ]}
                  onPress={handlePickFromLibrary}
                >
                  <Text
                    style={[
                      styles.mediaButtonText,
                      { color: palette.primary },
                    ]}
                  >
                    從相簿選擇
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.mediaButton,
                    { borderColor: palette.primary },
                  ]}
                  onPress={handleTakePhoto}
                >
                  <Text
                    style={[
                      styles.mediaButtonText,
                      { color: palette.primary },
                    ]}
                  >
                    開啟相機
                  </Text>
                </TouchableOpacity>
              </View>

              {mediaUri ? (
                <Pressable
                  onPress={() => setMediaUri('')}
                  style={styles.mediaClear}
                >
                  <Text
                    style={{ color: palette.subText, fontSize: 12 }}
                  >
                    移除媒體
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.label, { color: palette.subText }]}>
              推薦產品連結 (選填)
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: inputBg, color: palette.text },
              ]}
              placeholder="https://shopee..."
              placeholderTextColor={palette.subText}
              value={productLink}
              onChangeText={setProductLink}
              autoCapitalize="none"
            />

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: palette.primary,
                  opacity: submitting ? 0.7 : 1,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitBtnText}>發布貼文</Text>
              )}
            </Pressable>
          </>
        }
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  // Form
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  // 媒體卡片區塊
  mediaCard: {
    borderRadius: 12,
    padding: 12,
  },
  mediaPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#e5e5e5',
  },
  mediaPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  mediaButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  mediaClear: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  submitBtn: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default ForumCreatePost;
