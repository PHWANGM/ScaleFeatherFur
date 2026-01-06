// src/screens/user/ResetPasswordScreen.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/rootNavigator';
import { supabase } from '../../lib/supabase';
import { useThemeColors } from '../../styles/themesColors';
import { theme } from '../../styles/tokens';

type Phase = 'waiting_link' | 'exchanging' | 'ready' | 'done' | 'error';

function parseParamsFromUrl(url: string): Record<string, string> {
  // 支援：
  // 1) exp://.../auth/reset#access_token=...&refresh_token=...
  // 2) exp://.../auth/reset?code=...
  // 3) 任何其他 query / hash
  const out: Record<string, string> = {};

  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const queryString =
    queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
  const hashString = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';

  const parseKV = (s: string) => {
    if (!s) return;
    s.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (!k) return;
      out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    });
  };

  parseKV(queryString);
  parseKV(hashString);

  return out;
}

export default function ResetPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, isDark } = useThemeColors();

  const [phase, setPhase] = useState<Phase>('waiting_link');
  const [msg, setMsg] = useState('等待重設連結...');
  const [err, setErr] = useState<string | null>(null);
  const [receivedUrl, setReceivedUrl] = useState<string | null>(null);

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

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

  const handleUrl = useCallback(async (url: string) => {
    console.log('[ResetPassword] DEEPLINK RECEIVED:', url);
    setReceivedUrl(url);
    setErr(null);

    const params = parseParamsFromUrl(url);

    const access_token = params['access_token'];
    const refresh_token = params['refresh_token'];
    const code = params['code'];
    const type = params['type'];

    console.log('[ResetPassword] parsed params:', {
      has_access_token: !!access_token,
      has_refresh_token: !!refresh_token,
      has_code: !!code,
      type,
    });

    try {
      setPhase('exchanging');
      setMsg('正在驗證重設連結...');

      // ✅ A) hash token flow：#access_token=...&refresh_token=...
      if (access_token && refresh_token) {
        setMsg('正在建立 session（token flow）...');
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) throw error;

        if (!data.session) {
          throw new Error('setSession 成功但沒有 session，請重新點信件連結。');
        }

        setPhase('ready');
        setMsg('請輸入新密碼');
        return;
      }

      // ✅ B) PKCE flow：?code=...
      if (code) {
        setMsg('正在交換 session（code flow）...');
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) throw error;

        if (!data.session) {
          throw new Error('exchangeCodeForSession 後沒有 session，請重新點信件連結。');
        }

        setPhase('ready');
        setMsg('請輸入新密碼');
        return;
      }

      // ❌ 沒拿到任何需要的參數
      setPhase('error');
      setErr('重設連結缺少必要參數（沒有 access_token/refresh_token，也沒有 code）。請重新點信件連結。');
    } catch (e: any) {
      console.warn('[ResetPassword] handleUrl failed:', e);
      setPhase('error');
      setErr(e?.message ?? '驗證失敗');
    }
  }, []);

  useEffect(() => {
    let sub: any;

    (async () => {
      try {
        // 1) App 被 link 打開時的初始 URL
        const initialUrl = await Linking.getInitialURL();
        console.log('[ResetPassword] initialUrl:', initialUrl);
        if (initialUrl) {
          await handleUrl(initialUrl);
        } else {
          setPhase('waiting_link');
          setMsg('等待重設連結...（請從 Email 點入）');
        }
      } catch (e) {
        console.warn('[ResetPassword] getInitialURL failed:', e);
        setPhase('waiting_link');
        setMsg('等待重設連結...（請從 Email 點入）');
      }
    })();

    // 2) App 已開啟時收到 deep link
    sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => sub?.remove?.();
  }, [handleUrl]);

  const canSave = pw1.length >= 6 && pw1 === pw2 && !saving;

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;

      setPhase('done');
      setMsg('密碼已更新！請重新登入。');

      navigation.replace('Login');
    } catch (e: any) {
      setErr(e?.message ?? '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>重設密碼</Text>
        <Text style={[styles.sub, { color: palette.subText }]}>{msg}</Text>

        {(phase === 'waiting_link' || phase === 'exchanging') && (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        )}

        {!!receivedUrl && (
          <Text style={[styles.debug, { color: palette.subText }]}>
            receivedUrl: {receivedUrl}
          </Text>
        )}

        {phase === 'error' && (
          <>
            <Text style={[styles.err, { color: palette.danger }]}>{err}</Text>
            <Pressable
              style={[styles.btn, { backgroundColor: palette.primary }]}
              onPress={() => navigation.replace('Login')}
            >
              <Text style={[styles.btnText, { color: palette.bg }]}>回登入</Text>
            </Pressable>
          </>
        )}

        {phase === 'ready' && (
          <>
            <Text style={[styles.label, { color: palette.text, marginTop: theme.spacing.md }]}>新密碼</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Feather name="lock" size={18} color={palette.subText} />
              <TextInput
                value={pw1}
                onChangeText={setPw1}
                placeholder="至少 6 碼"
                placeholderTextColor={palette.subText}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: palette.text }]}
              />
              <Pressable onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                <Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={palette.subText} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: palette.text, marginTop: theme.spacing.md }]}>再輸入一次</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}>
              <Feather name="lock" size={18} color={palette.subText} />
              <TextInput
                value={pw2}
                onChangeText={setPw2}
                placeholder="請再輸入一次"
                placeholderTextColor={palette.subText}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: palette.text }]}
              />
            </View>

            {!!err && <Text style={[styles.err, { color: palette.danger }]}>{err}</Text>}

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              style={[styles.btn, { backgroundColor: palette.primary }, !canSave && { opacity: 0.5 }]}
            >
              <Text style={[styles.btnText, { color: palette.bg }]}>{saving ? '更新中...' : '更新密碼'}</Text>
            </Pressable>
          </>
        )}

        {phase === 'done' && (
          <Pressable
            style={[styles.btn, { backgroundColor: palette.primary }]}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={[styles.btnText, { color: palette.bg }]}>回登入</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg },
  card: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { marginTop: 8, lineHeight: 18 },

  debug: { marginTop: 10, fontSize: 12, lineHeight: 16 },

  label: { fontWeight: '800' },
  inputRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.select({ ios: theme.spacing.md, android: theme.spacing.sm }),
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1 },
  eyeBtn: { paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.xs },

  err: { marginTop: 10, fontWeight: '800' },

  btn: {
    marginTop: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  btnText: { fontWeight: '900' },
});
