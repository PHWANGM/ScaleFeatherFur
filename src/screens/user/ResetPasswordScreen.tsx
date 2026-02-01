// src/screens/user/ResetPasswordScreen.tsx
import { useCallback, useEffect, useMemo, useState } from "react"
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
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../navigation/rootNavigator"
import { supabase } from "../../lib/supabase"
import { useThemeColors } from "../../styles/themesColors"
import { theme } from "../../styles/tokens"
import { useTranslation } from "react-i18next"

type Phase = "waiting_link" | "exchanging" | "ready" | "done" | "error"

export default function ResetPasswordScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()
  const { colors, isDark } = useThemeColors()

  const [phase, setPhase] = useState<Phase>("waiting_link")
  const [msg, setMsg] = useState(t("resetPassword.phases.waiting"))
  const [err, setErr] = useState<string | null>(null)
  const [pw1, setPw1] = useState("")
  const [pw2, setPw2] = useState("")
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      subText: colors.subText ?? colors.textDim ?? "#97A3B6",
      primary: colors.primary ?? theme.colors.primary,
      inputBg: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
      danger: theme.colors.critical,
    }),
    [colors, isDark],
  )

  const handleUrl = useCallback(
    async (url: string) => {
      try {
        setPhase("exchanging")
        const { error } = await supabase.auth.exchangeCodeForSession(url)
        if (error) throw error
        setPhase("ready")
        setMsg(t("resetPassword.phases.enterNew"))
      } catch (e: unknown) {
        setPhase("error")
        setErr(e?.message ?? t("resetPassword.phases.failed"))
      }
    },
    [t],
  )

  useEffect(() => {
    ;(async () => {
      const initialUrl = await Linking.getInitialURL()
      if (initialUrl) await handleUrl(initialUrl)
    })()
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [handleUrl])

  // ✅ 如果使用者切換語言，waiting 狀態的預設 msg 也跟著更新（不覆蓋 ready/error 狀態）
  useEffect(() => {
    if (phase === "waiting_link") setMsg(t("resetPassword.phases.waiting"))
  }, [t, phase])

  const onSave = async () => {
    setSaving(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 })
      if (error) throw error
      navigation.replace("Login")
    } catch (e: unknown) {
      setErr(e?.message ?? t("resetPassword.errors.updateFailed"))
    } finally {
      setSaving(false)
    }
  }

  const canSave = pw1 === pw2 && pw1.length >= 6 && !saving

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
          <View
            style={[styles.card, {
              backgroundColor: palette.card,
              borderColor: palette.border,
            }]}
          >
            <Text style={[styles.title, { color: palette.text }]}>
              {t("resetPassword.title")}
            </Text>
            <Text style={[styles.sub, { color: palette.subText }]}>{msg}</Text>

            {phase === "ready" && (
              <>
                <Text
                  style={[styles.label, {
                    color: palette.text,
                    marginTop: theme.spacing.md,
                  }]}
                >
                  {t("resetPassword.fields.newPassword")}
                </Text>
                <View
                  style={[styles.inputRow, {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.border,
                  }]}
                >
                  <Feather name="lock" size={18} color={palette.subText} />
                  <TextInput
                    value={pw1}
                    onChangeText={setPw1}
                    placeholder={t("resetPassword.placeholders.min6")}
                    placeholderTextColor={palette.subText}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    style={[styles.input, { color: palette.text }]}
                  />
                  <Pressable onPress={() => setShowPw(!showPw)}>
                    <Feather
                      name={showPw ? "eye-off" : "eye"}
                      size={18}
                      color={palette.subText}
                    />
                  </Pressable>
                </View>

                <Text
                  style={[styles.label, {
                    color: palette.text,
                    marginTop: theme.spacing.md,
                  }]}
                >
                  {t("resetPassword.fields.confirmPassword")}
                </Text>
                <View
                  style={[styles.inputRow, {
                    backgroundColor: palette.inputBg,
                    borderColor: palette.border,
                  }]}
                >
                  <Feather name="lock" size={18} color={palette.subText} />
                  <TextInput
                    value={pw2}
                    onChangeText={setPw2}
                    placeholder={t("resetPassword.placeholders.confirm")}
                    placeholderTextColor={palette.subText}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    style={[styles.input, { color: palette.text }]}
                  />
                </View>

                {!!err && (
                  <Text style={[styles.err, { color: palette.danger }]}>
                    {err}
                  </Text>
                )}

                <Pressable
                  onPress={onSave}
                  disabled={!canSave}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: palette.primary,
                      opacity: canSave ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: palette.bg }]}>
                    {saving
                      ? t("resetPassword.actions.updating")
                      : t("resetPassword.actions.update")}
                  </Text>
                </Pressable>
              </>
            )}

            {phase === "error" && (
              <Pressable
                style={[styles.btn, { backgroundColor: palette.primary }]}
                onPress={() => navigation.replace("Login")}
              >
                <Text style={[styles.btnText, { color: palette.bg }]}>
                  {t("resetPassword.actions.backToLogin")}
                </Text>
              </Pressable>
            )}
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
  label: { fontWeight: "800" },
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
  btn: {
    marginTop: theme.spacing.md,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    alignItems: "center",
  },
  btnText: { fontWeight: "900" },
})
