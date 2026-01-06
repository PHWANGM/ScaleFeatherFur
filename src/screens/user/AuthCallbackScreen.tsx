import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/rootNavigator';
import { supabase } from '../../lib/supabase';
import { useThemeColors } from '../../styles/themesColors';
import { theme } from '../../styles/tokens';

export default function AuthCallbackScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useThemeColors();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState<string>('正在驗證中...');

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      card: colors.card,
      border: colors.border,
      primary: colors.primary ?? theme.colors.primary,
      danger: theme.colors.critical,
    }),
    [colors]
  );

  async function handleUrl(url: string) {
    try {
      setStatus('loading');
      setMessage('正在交換 session...');

      // ✅ Supabase v2：用驗證信回來的 code 交換 session
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) throw error;

      if (!data.session) {
        // 有些情況可能只有 user 沒有 session
        setStatus('ok');
        setMessage('驗證完成，請回登入。');
        return;
      }

      setStatus('ok');
      setMessage('驗證完成！正在進入 App...');

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e: any) {
      console.warn('[AuthCallbackScreen] failed:', e);
      setStatus('error');
      setMessage(e?.message ?? '驗證失敗，請重試');
    }
  }

  useEffect(() => {
    let sub: any;

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleUrl(initialUrl);
      } else {
        setStatus('error');
        setMessage('沒有收到回跳連結。請從 Email 驗證信點入。');
      }
    })();

    // 也監聽 app 在前景時收到 link
    sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      sub?.remove?.();
    };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <ActivityIndicator />
        <Text style={[styles.title, { color: palette.text, marginTop: 14 }]}>
          Email 驗證
        </Text>
        <Text style={[styles.sub, { color: status === 'error' ? palette.danger : palette.subText }]}>
          {message}
        </Text>

        {status === 'error' && (
          <Pressable
            style={[styles.btn, { backgroundColor: palette.primary }]}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={[styles.btnText, { color: palette.bg }]}>回登入</Text>
          </Pressable>
        )}

        {status === 'ok' && (
          <Pressable
            style={[styles.btn, { backgroundColor: palette.primary }]}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
          >
            <Text style={[styles.btnText, { color: palette.bg }]}>進入 App</Text>
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
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { marginTop: 8, textAlign: 'center', lineHeight: 18 },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: theme.radii.md,
  },
  btnText: { fontWeight: '900' },
});
