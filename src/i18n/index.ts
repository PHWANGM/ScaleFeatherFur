// src/i18n/index.ts
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Localization from "expo-localization"

import zh from "./locales/zh-TW.json"
import en from "./locales/en.json"

export const LANG_KEY = "app_language"

function normalizeLang(raw?: string | null) {
  const s = (raw ?? "").toLowerCase()
  if (s.startsWith("zh")) return "zh"
  if (s.startsWith("en")) return "en"
  return "en"
}

async function detectInitialLanguage() {
  const saved = await AsyncStorage.getItem(LANG_KEY)
  if (saved) return normalizeLang(saved)

  const sys = Localization.getLocales?.()?.[0]?.languageTag ??
    Localization.locale
  return normalizeLang(sys)
}

export async function initI18n() {
  const lng = await detectInitialLanguage()

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        zh: { translation: zh },
      },
      lng,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v3",
    })
  } else {
    await i18n.changeLanguage(lng)
  }

  return lng
}

export default i18n
