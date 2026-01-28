import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";

const resources = {
  "zh-TW": { translation: zhTW },
  en: { translation: en },
};

function pickInitialLanguage() {
  const locale = (Localization.getLocales()[0]?.languageTag ?? "en").toLowerCase();
  return locale.startsWith("zh") ? "zh-TW" : "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: pickInitialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
