// src/screens/SignUpScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/rootNavigator';
import { useThemeColors } from '../../styles/themesColors';
import { theme } from '../../styles/tokens';
import PrimaryButton from '../../components/buttons/PrimaryButton';

import { signUpWithEmail, toUserMessage } from '../../lib/supabase/repos/auth.repo';

export default function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useThemeColors();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? theme.colors.primary,
      inputBg: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      danger: theme.colors.critical,
    }),
    [colors, isDark]
  );

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && e.includes('@') && password.length >= 6 && !loading;
  }, [email, password, loading]);

  const onSignup = async () => {
    setErr(null);
    setHint(null);
    setLoading(true);
    try {
      const res = await signUpWithEmail({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });

      // ✅ 若你的專案需要 email 確認，session 可能為 null
      if (!res.session) {
        setHint('已送出驗證信，請到信箱完成驗證後再登入。');
        // 也可以直接導回 Login，讓使用者登入
        return;
      }

      // ✅ 若已拿到 session，代表可直接進 App
      navigation.replace('MainTabs');
    } catch (e: any) {
      setErr(toUserMessage(e, '註冊失敗'));
    } finally {
      setLoading(false);
    }
  };

  const onGoLogin = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: palette.primary }]}>
            <Feather name="user-plus" size={18} color={isDark ? '#ffffff' : '#122017'} />
          </View>
          <Text style={[styles.title, { color: palette.text }]}>註冊</Text>
          <Text style={[styles.subtitle, { color: palette.subText }]}>
            建立帳號後即可同步雲端個人資料與社群功能
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.label, { color: palette.text }]}>顯示名稱（可選）</Text>
          <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
            <Feather name="user" size={18} color={palette.subText} />
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="例如：Joseph"
              placeholderTextColor={palette.subText}
              autoCapitalize="words"
              autoCorrect={false}
              style={[styles.input, { color: palette.text }]}
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <Text style={[styles.label, { marginTop: theme.spacing.md, color: palette.text }]}>Email</Text>
          <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
            <Feather name="mail" size={18} color={palette.subText} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={palette.subText}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={[styles.input, { color: palette.text }]}
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <Text style={[styles.label, { marginTop: theme.spacing.md, color: palette.text }]}>Password</Text>
          <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
            <Feather name="lock" size={18} color={palette.subText} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="至少 6 碼"
              placeholderTextColor={palette.subText}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, { color: palette.text }]}
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSubmit) onSignup();
              }}
            />
            <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} accessibilityRole="button">
              <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={palette.subText} />
            </Pressable>
          </View>

          {!!err && (
            <View style={[styles.errorBox, { borderColor: palette.danger }]}>
              <Feather name="alert-triangle" size={16} color={palette.danger} />
              <Text style={[styles.errorText, { color: palette.danger }]}>{err}</Text>
            </View>
          )}

          {!!hint && (
            <View style={[styles.hintBox, { borderColor: palette.border }]}>
              <Feather name="info" size={16} color={palette.subText} />
              <Text style={[styles.hintText, { color: palette.subText }]}>{hint}</Text>
            </View>
          )}

          <PrimaryButton
            title="建立帳號"
            onPress={onSignup}
            disabled={!canSubmit}
            loading={loading}
            style={styles.primaryBtn}
          />

          <Pressable onPress={onGoLogin} disabled={loading} style={styles.linkBtn}>
            <Text style={[styles.linkText, { color: palette.subText }]}>已經有帳號？回登入</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: theme.spacing.lg, justifyContent: 'center' },

  header: { marginBottom: theme.spacing.md },
  logo: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: { ...theme.typography.h1 },
  subtitle: { ...theme.typography.body, marginTop: theme.spacing.xs, lineHeight: 20 },

  card: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...theme.typography.h3, marginBottom: theme.spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.select({ ios: theme.spacing.md, android: theme.spacing.sm }),
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, ...theme.typography.body },
  eyeBtn: { paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xs },

  errorBox: {
    marginTop: theme.spacing.md,
    backgroundColor: 'rgba(255, 90, 95, 0.12)',
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { flex: 1, lineHeight: 18 },

  hintBox: {
    marginTop: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  hintText: { flex: 1, lineHeight: 18 },

  primaryBtn: { marginTop: theme.spacing.md },

  linkBtn: { marginTop: theme.spacing.sm, paddingVertical: theme.spacing.sm, alignItems: 'center' },
  linkText: { fontWeight: '700' },
});
