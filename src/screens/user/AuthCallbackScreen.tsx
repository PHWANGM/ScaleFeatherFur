// src/screens/user/AuthCallbackScreen.tsx
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Linking from "expo-linking"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../navigation/rootNavigator"
import { supabase } from "../../lib/supabase"
import { useThemeColors } from "../../styles/themesColors"
import { theme } from "../../styles/tokens"
import { useTranslation } from "react-i18next"

type Phase = "verifying" | "exchanging" | "success" | "noLink" | "error"

export default function AuthCallbackScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<
    NativeStackNavigationProp<RootStackParamList>
  >()
  const { colors } = useThemeColors()

  const [phase, setPhase] = useState<Phase>("verifying")
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const status: "loading" | "ok" | "error" = phase === "success"
    ? "ok"
    : phase === "error" || phase === "noLink"
    ? "error"
    : "loading"

  const message = useMemo(() => {
    switch (phase) {
      case "verifying":
        return t("authCallback.messages.verifying")
      case "exchanging":
        return t("authCallback.messages.exchanging")
      case "success":
        return t("authCallback.messages.success")
      case "noLink":
        return t("authCallback.messages.noLink")
      case "error": {
        const base = t("authCallback.messages.failed")
        return errorDetail ? `${base}\n${errorDetail}` : base
      }
      default:
        return t("authCallback.messages.verifying")
    }
  }, [phase, errorDetail, t])

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      text: colors.text,
      subText: colors.subText ?? colors.textDim ?? "#97A3B6",
      card: colors.card,
      border: colors.border,
      primary: colors.primary ?? theme.colors.primary,
      danger: theme.colors.critical,
    }),
    [colors],
  )

  async function handleUrl(url: string) {
    try {
      setErrorDetail(null)
      setPhase("exchanging")

      const { error } = await supabase.auth.exchangeCodeForSession(url)
      if (error) throw error

      setPhase("success")
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] })
    } catch (e: unknown) {
      setPhase("error")
      setErrorDetail(e instanceof Error ? e.message : null)
    }
  }

  useEffect(() => {
    ;(async () => {
      setPhase("verifying")
      setErrorDetail(null)

      const initialUrl = await Linking.getInitialURL()
      if (initialUrl) {
        await handleUrl(initialUrl)
      } else {
        setPhase("noLink")
      }
    })()

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url)
    })

    return () => {
      sub?.remove?.()
    }
  }, [])

  const onPrimaryPress = () => {
    if (status === "error") navigation.replace("Login")
    else navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] })
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View
          style={[styles.card, {
            backgroundColor: palette.card,
            borderColor: palette.border,
          }]}
        >
          <ActivityIndicator color={palette.primary} />

          <Text style={[styles.title, { color: palette.text, marginTop: 14 }]}>
            {t("authCallback.title")}
          </Text>

          <Text
            style={[styles.sub, {
              color: status === "error" ? palette.danger : palette.subText,
            }]}
          >
            {message}
          </Text>

          {(status === "error" || status === "ok") && (
            <Pressable
              style={[styles.btn, { backgroundColor: palette.primary }]}
              onPress={onPrimaryPress}
            >
              <Text style={[styles.btnText, { color: palette.bg }]}>
                {status === "error"
                  ? t("authCallback.actions.backToLogin")
                  : t("authCallback.actions.enterApp")}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
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
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "900" },
  sub: { marginTop: 8, textAlign: "center", lineHeight: 18 },
  btn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.radii.md,
  },
  btnText: { fontWeight: "900" },
})
