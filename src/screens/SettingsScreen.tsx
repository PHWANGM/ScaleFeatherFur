import React, { useEffect, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { useTranslation } from "react-i18next"
import { loadLanguage, setLanguage } from "../i18n/language"

type Lang = "system" | "zh-TW" | "en"

export default function SettingsScreen() {
  const { t } = useTranslation()
  const [lang, setLang] = useState<Lang>("system")

  useEffect(() => {
    loadLanguage().then((v) => setLang(v as Lang))
  }, [])

  async function pick(v: Lang) {
    setLang(v)
    await setLanguage(v) // 立即生效 + 記住
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>
        {t("settings.title")}
      </Text>
      <Text>{t("settings.language")}</Text>

      <Pressable onPress={() => pick("system")}>
        <Text>
          {lang === "system" ? "✅ " : ""}
          {t("settings.followSystem")}
        </Text>
      </Pressable>

      <Pressable onPress={() => pick("zh-TW")}>
        <Text>{lang === "zh-TW" ? "✅ " : ""}{t("settings.chinese")}</Text>
      </Pressable>

      <Pressable onPress={() => pick("en")}>
        <Text>{lang === "en" ? "✅ " : ""}{t("settings.english")}</Text>
      </Pressable>
    </View>
  )
}
