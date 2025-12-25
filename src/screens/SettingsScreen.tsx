// src/screens/SettingsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../styles/tokens';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  hasGeminiApiKey,
  clearGeminiApiKey,
} from '../lib/ai/config';

const GOOGLE_AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 載入現有 API Key
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setLoading(true);
    try {
      const exists = await hasGeminiApiKey();
      setHasKey(exists);
      if (exists) {
        const key = await getGeminiApiKey();
        setApiKey(key);
      }
    } catch (err) {
      console.error('[Settings] Failed to load API key:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('錯誤', '請輸入 API Key');
      return;
    }

    // 驗證格式（Gemini API Key 通常以 AIza 開頭）
    if (!apiKey.trim().startsWith('AIza')) {
      Alert.alert(
        '格式可能有誤',
        'Gemini API Key 通常以 "AIza" 開頭。確定要儲存嗎？',
        [
          { text: '取消', style: 'cancel' },
          { text: '確定儲存', onPress: () => saveKey() },
        ]
      );
      return;
    }

    await saveKey();
  };

  const saveKey = async () => {
    setSaving(true);
    try {
      await setGeminiApiKey(apiKey.trim());
      setHasKey(true);
      Alert.alert('成功', 'API Key 已儲存！現在可以使用 AI 食物辨識功能了。', [
        { text: '好', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('[Settings] Failed to save API key:', err);
      Alert.alert('錯誤', '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      '確認清除',
      '確定要清除 API Key 嗎？清除後將無法使用 AI 功能。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearGeminiApiKey();
              setApiKey('');
              setHasKey(false);
              Alert.alert('已清除', 'API Key 已移除');
            } catch (err) {
              Alert.alert('錯誤', '清除失敗');
            }
          },
        },
      ]
    );
  };

  const openGoogleAIStudio = () => {
    Linking.openURL(GOOGLE_AI_STUDIO_URL);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI 功能設定</Text>
          <Text style={styles.description}>
            使用 Google Gemini Vision API 進行食物影像辨識。
            {'\n'}請先取得 API Key 後在下方輸入。
          </Text>
        </View>

        {/* 取得 API Key 說明 */}
        <View style={styles.section}>
          <Text style={styles.label}>步驟 1：取得 API Key</Text>
          <TouchableOpacity style={styles.linkButton} onPress={openGoogleAIStudio}>
            <Feather name="external-link" size={18} color={theme.colors.primary} />
            <Text style={styles.linkText}>前往 Google AI Studio</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            1. 登入 Google 帳號{'\n'}
            2. 點擊「Create API Key」{'\n'}
            3. 複製產生的 Key
          </Text>
        </View>

        {/* API Key 輸入 */}
        <View style={styles.section}>
          <Text style={styles.label}>步驟 2：輸入 API Key</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="AIza..."
              placeholderTextColor={theme.colors.textDim}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowKey(!showKey)}
            >
              <Feather
                name={showKey ? 'eye-off' : 'eye'}
                size={20}
                color={theme.colors.textDim}
              />
            </TouchableOpacity>
          </View>

          {hasKey && (
            <View style={styles.statusRow}>
              <Feather name="check-circle" size={16} color={theme.colors.success} />
              <Text style={styles.statusText}>API Key 已設定</Text>
            </View>
          )}
        </View>

        {/* 按鈕區 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="save" size={18} color="#fff" />
                <Text style={styles.buttonText}>儲存 API Key</Text>
              </>
            )}
          </TouchableOpacity>

          {hasKey && (
            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleClear}
            >
              <Feather name="trash-2" size={18} color={theme.colors.critical} />
              <Text style={[styles.buttonText, styles.dangerText]}>清除 API Key</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 隱私提示 */}
        <View style={styles.section}>
          <Text style={styles.privacyNote}>
            🔒 API Key 會安全儲存在您的裝置上，不會上傳至任何伺服器。
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    ...theme.typography.h2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.textDim,
    lineHeight: 22,
  },
  label: {
    ...theme.typography.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.sm,
  },
  linkText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  hint: {
    ...theme.typography.small,
    color: theme.colors.textDim,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  input: {
    flex: 1,
    padding: theme.spacing.md,
    ...theme.typography.body,
    color: theme.colors.text,
  },
  eyeButton: {
    padding: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  statusText: {
    ...theme.typography.small,
    color: theme.colors.success,
  },
  buttonContainer: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  dangerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.critical,
  },
  buttonText: {
    ...theme.typography.body,
    color: '#fff',
    fontWeight: '600',
  },
  dangerText: {
    color: theme.colors.critical,
  },
  privacyNote: {
    ...theme.typography.small,
    color: theme.colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
