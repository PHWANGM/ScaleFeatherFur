import AsyncStorage from "@react-native-async-storage/async-storage"
import i18n from "./index"
import * as Localization from "expo-localization"

const KEY = "app_language"
// 建議存： "system" | "zh-TW" | "en"

export async function loadLanguage() {
  const saved = await AsyncStorage.getItem(KEY)
  if (!saved || saved === "system") {
    const locale = Localization.getLocales()[0]?.languageTag ?? "en"
    const lng = locale.toLowerCase().startsWith("zh") ? "zh-TW" : "en"
    await i18n.changeLanguage(lng)
    return "system"
  }
  await i18n.changeLanguage(saved)
  return saved
}

export async function setLanguage(lng: "system" | "zh-TW" | "en") {
  await AsyncStorage.setItem(KEY, lng)
  if (lng === "system") {
    const locale = Localization.getLocales()[0]?.languageTag ?? "en"
    const real = locale.toLowerCase().startsWith("zh") ? "zh-TW" : "en"
    await i18n.changeLanguage(real)
  } else {
    await i18n.changeLanguage(lng)
  }
}
