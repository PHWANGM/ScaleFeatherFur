import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
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

  const palette = useMemo(() => ({
    bg: colors.bg, card: colors.card, text: colors.text, border: colors.border,
    subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
    primary: colors.primary ?? theme.colors.primary,
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
    danger: theme.colors.critical,
  }), [colors, isDark]);

  const canSubmit = email.includes('@') && password.length >= 6 && !loading;

  const onSignup = async () => {
    setErr(null); setHint(null); setLoading(true);
    try {
      const res = await signUpWithEmail({ email, password, displayName: displayName.trim() || undefined });
      if (!res.session) setHint('已送出驗證信，請到信箱完成驗證。');
      else navigation.replace('MainTabs');
    } catch (e: any) { setErr(toUserMessage(e, '註冊失敗')); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right' ]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.logo, { backgroundColor: palette.primary }]}><Feather name="user-plus" size={18} color={isDark ? '#ffffff' : '#122017'} /></View>
            <Text style={[styles.title, { color: palette.text }]}>註冊</Text>
            <Text style={[styles.subtitle, { color: palette.subText }]}>建立帳號後即可同步雲端個人資料</Text>
          </View>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.label, { color: palette.text }]}>顯示名稱（可選）</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}><Feather name="user" size={18} color={palette.subText} /><TextInput value={displayName} onChangeText={setDisplayName} placeholder="例如：Joseph" placeholderTextColor={palette.subText} style={[styles.input, { color: palette.text }]} /></View>
            <Text style={[styles.label, { marginTop: theme.spacing.md, color: palette.text }]}>Email</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}><Feather name="mail" size={18} color={palette.subText} /><TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" style={[styles.input, { color: palette.text }]} /></View>
            <Text style={[styles.label, { marginTop: theme.spacing.md, color: palette.text }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: palette.inputBg, borderColor: palette.border }]}><Feather name="lock" size={18} color={palette.subText} /><TextInput value={password} onChangeText={setPassword} placeholder="至少 6 碼" secureTextEntry={!showPw} style={[styles.input, { color: palette.text }]} /><Pressable onPress={() => setShowPw(!showPw)}><Feather name={showPw ? 'eye-off' : 'eye'} size={18} color={palette.subText} /></Pressable></View>
            {!!err && <View style={styles.errorBox}><Text style={[styles.errorText, { color: palette.danger }]}>{err}</Text></View>}
            {!!hint && <View style={styles.hintBox}><Text style={[styles.hintText, { color: palette.subText }]}>{hint}</Text></View>}
            <PrimaryButton title="建立帳號" onPress={onSignup} disabled={!canSubmit} loading={loading} style={{ marginTop: theme.spacing.md }} />
            <Pressable onPress={() => navigation.replace('Login')} style={styles.linkBtn}><Text style={[styles.linkText, { color: palette.subText }]}>已經有帳號？回登入</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContainer: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    padding: theme.spacing.lg,
    paddingBottom: 40 // 增加底部留白，避免鍵盤彈起時按鈕太貼邊
  },
  header: { marginBottom: theme.spacing.md },
  logo: { 
    width: 36, 
    height: 36, 
    borderRadius: theme.radii.md, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: theme.spacing.sm 
  },
  title: { ...theme.typography.h1 },
  subtitle: { ...theme.typography.body, marginTop: theme.spacing.xs, lineHeight: 20 },
  card: { 
    borderRadius: theme.radii.lg, 
    padding: theme.spacing.lg, 
    borderWidth: StyleSheet.hairlineWidth 
  },
  label: { ...theme.typography.h3, marginBottom: theme.spacing.sm },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: theme.spacing.sm, 
    borderRadius: theme.radii.md, 
    paddingHorizontal: theme.spacing.md, 
    paddingVertical: Platform.OS === 'ios' ? 14 : 4, 
    borderWidth: StyleSheet.hairlineWidth 
  },
  input: { flex: 1, ...theme.typography.body },
  eyeBtn: { padding: 4 },
  
  // 修正：補上缺失的 errorText 與 errorBox 樣式
  errorBox: { 
    marginTop: theme.spacing.md, 
    padding: theme.spacing.sm, 
    backgroundColor: 'rgba(255, 90, 95, 0.1)',
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  errorText: { 
    flex: 1, 
    fontSize: 13, 
    lineHeight: 18,
    fontWeight: '500'
  },

  // 修正：補上缺失的 hintText 與 hintBox 樣式
  hintBox: { 
    marginTop: theme.spacing.md, 
    padding: theme.spacing.sm, 
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: theme.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  hintText: { 
    flex: 1, 
    fontSize: 13, 
    lineHeight: 18,
    fontWeight: '500'
  },

  primaryBtn: { marginTop: theme.spacing.md },
  linkBtn: { 
    marginTop: theme.spacing.sm, 
    paddingVertical: theme.spacing.sm, 
    alignItems: 'center' 
  },
  linkText: { fontWeight: '700' },
});