// src/screens/user/ForgotPasswordScreen.tsx
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
import * as Linking from "expo-linking"
import Constants from "expo-constants"
import { supabase } from "../../lib/supabase"
import { useThemeColors } from "../../styles/themesColors"
import { theme } from "../../styles/tokens"
import { useTranslation } from "react-i18next"

export default function ForgotPasswordScreen() {
  const { t } = useTranslation()
  const { colors, isDark } = useThemeColors()

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? colors.textDim ?? "#97A3B6",
      border: colors.border,
      primary: colors.primary ?? theme.colors.primary,
      inputBg: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
      danger: theme.colors.critical,
    }),
    [colors, isDark],
  )

  const isValidEmail = /^\S+@\S+\.\S+$/.test(email.trim().toLowerCase())
  const isExpoGo = Constants.appOwnership === "expo"

  const onSend = async () => {
    setErr(null)
    setMsg(null)
    setLoading(true)

    try {
      const redirectTo = isExpoGo
        ? Linking.createURL("auth/reset")
        : "scaleff://auth/reset"
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      )
      if (error) throw error

      setMsg(t("forgotPassword.success"))
    } catch (e: unknown) {
      setErr(e?.message ?? t("forgotPassword.errors.sendFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[styles.card, {
              backgroundColor: palette.card,
              borderColor: palette.border,
            }]}
          >
            <Text style={[styles.title, { color: palette.text }]}>
              {t("forgotPassword.title")}
            </Text>
            <Text style={[styles.sub, { color: palette.subText }]}>
              {t("forgotPassword.subtitle")}
            </Text>

            <Text style={[styles.label, { color: palette.text }]}>
              {t("forgotPassword.emailLabel")}
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
                placeholder={t("forgotPassword.emailPlaceholder")}
                placeholderTextColor={palette.subText}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { color: palette.text }]}
                editable={!loading}
              />
            </View>

            {!!err && (
              <Text style={[styles.err, { color: palette.danger }]}>{err}</Text>
            )}
            {!!msg && (
              <Text style={[styles.msg, { color: palette.subText }]}>
                {msg}
              </Text>
            )}

            <Pressable
              onPress={onSend}
              disabled={loading || !isValidEmail}
              style={[
                styles.btn,
                { backgroundColor: palette.primary },
                (loading || !isValidEmail) && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.btnText, { color: palette.bg }]}>
                {loading
                  ? t("forgotPassword.actions.sending")
                  : t("forgotPassword.actions.send")}
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
  card: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: "900" },
  sub: { marginTop: 8, lineHeight: 18 },
  label: { marginTop: theme.spacing.md, fontWeight: "800" },
  inputRow: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1 },
  err: { marginTop: 10, fontWeight: "800" },
  msg: { marginTop: 10, lineHeight: 18 },
  btn: {
    marginTop: theme.spacing.md,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    alignItems: "center",
  },
  btnText: { fontWeight: "900" },
})
