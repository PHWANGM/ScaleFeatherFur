// src/screens/user/LoginScreen.tsx
import React, { useMemo, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../navigation/rootNavigator"
import { supabase } from "../../lib/supabase"
import { useThemeColors } from "../../styles/themesColors"
import { theme } from "../../styles/tokens"
import PrimaryButton from "../../components/buttons/PrimaryButton"
import { flushOutboxToSupabase } from "../../lib/supabase/repos/outbox.sync"
import { useTranslation } from "react-i18next"

export default function LoginScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()
  const { colors, isDark } = useThemeColors()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      subText: colors.subText ?? (colors as any).textDim ?? "#97A3B6",
      primary: colors.primary ?? theme.colors.primary,
      inputBg: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
      danger: theme.colors.critical,
    }),
    [colors, isDark],
  )

  const canSubmit = email.includes("@") && password.length >= 6 && !loading

  const onLogin = async () => {
    setErr(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        setErr(error.message)
        return
      }

      // ✅ Login success: best-effort flush outbox to Supabase (do not block navigation)
      flushOutboxToSupabase(supabase)
        .then((r) => console.log("[flushOutboxToSupabase] result", r))
        .catch((e) => console.log("[flushOutboxToSupabase] failed", e))

      navigation.replace("MainTabs")
    } catch (e: any) {
      setErr(e?.message ?? t("login.errors.failedFallback"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={[styles.logo, { backgroundColor: palette.primary }]}>
              <Feather
                name="shield"
                size={18}
                color={isDark ? "#ffffff" : "#122017"}
              />
            </View>

            <Text style={[styles.title, { color: palette.text }]}>
              {t("login.title")}
            </Text>
            <Text style={[styles.subtitle, { color: palette.subText }]}>
              {t("login.subtitle")}
            </Text>
          </View>

          <View
            style={[styles.card, {
              backgroundColor: palette.card,
              borderColor: palette.border,
            }]}
          >
            <Text style={[styles.label, { color: palette.text }]}>
              {t("login.emailLabel")}
            </Text>
            <View
              style={[styles.inputRow, {
                backgroundColor: palette.inputBg,
                borderColor: palette.border,
              }]}
            >
              <Feather name="mail" size={18} color={palette.subText} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t("login.emailPlaceholder")}
                placeholderTextColor={palette.subText}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: palette.text }]}
                editable={!loading}
              />
            </View>

            <Text
              style={[styles.label, {
                marginTop: theme.spacing.md,
                color: palette.text,
              }]}
            >
              {t("login.passwordLabel")}
            </Text>
            <View
              style={[styles.inputRow, {
                backgroundColor: palette.inputBg,
                borderColor: palette.border,
              }]}
            >
              <Feather name="lock" size={18} color={palette.subText} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("login.passwordPlaceholder")}
                placeholderTextColor={palette.subText}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                style={[styles.input, { color: palette.text }]}
                editable={!loading}
              />
              <Pressable onPress={() => setShowPw(!showPw)}>
                <Feather
                  name={showPw ? "eye-off" : "eye"}
                  size={18}
                  color={palette.subText}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={() => navigation.navigate("ForgotPassword")}
              style={styles.forgotBtn}
            >
              <Text style={[styles.forgotText, { color: palette.subText }]}>
                {t("login.forgot")}
              </Text>
            </Pressable>

            {!!err && (
              <View style={[styles.errorBox, { borderColor: palette.danger }]}>
                <Feather
                  name="alert-triangle"
                  size={16}
                  color={palette.danger}
                />
                <Text style={[styles.errorText, { color: palette.danger }]}>
                  {err}
                </Text>
              </View>
            )}

            <PrimaryButton
              title={t("login.actions.submit")}
              onPress={onLogin}
              disabled={!canSubmit}
              loading={loading}
              style={styles.primaryBtn}
            />

            <Pressable
              onPress={() => navigation.navigate("Signup")}
              style={styles.linkBtn}
            >
              <Text style={[styles.linkText, { color: palette.subText }]}>
                {t("login.links.toSignup")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  header: { marginBottom: theme.spacing.md },
  logo: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  title: { ...theme.typography.h1 },
  subtitle: {
    ...theme.typography.body,
    marginTop: theme.spacing.xs,
    lineHeight: 20,
  },
  card: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...theme.typography.h3, marginBottom: theme.spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, ...theme.typography.body },
  forgotBtn: {
    marginTop: theme.spacing.sm,
    alignItems: "flex-end",
    paddingVertical: theme.spacing.xs,
  },
  forgotText: { fontWeight: "800" },
  errorBox: {
    marginTop: theme.spacing.md,
    backgroundColor: "rgba(255, 90, 95, 0.12)",
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    flexDirection: "row",
    gap: theme.spacing.xs,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { flex: 1, lineHeight: 18 },
  primaryBtn: { marginTop: theme.spacing.md },
  linkBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: "center",
  },
  linkText: { fontWeight: "700" },
})
