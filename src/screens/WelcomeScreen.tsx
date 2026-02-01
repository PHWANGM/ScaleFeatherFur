// src/screens/WelcomeScreen.tsx
import {
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CommonActions, useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../navigation/rootNavigator"

import { useThemeColors } from "../styles/themesColors"
import PrimaryButton from "../components/buttons/PrimaryButton"
import { useTranslation } from "react-i18next"

type WelcomeNavProp = NativeStackNavigationProp<RootStackParamList, "Welcome">

const BG_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAi8QkUtblqYYbRZu0aNY31whEBVoAzBHQttjygcaBWr7lmeWS-A1g3U4IvXs870XrrFMj8WTI35rGexst6aPb-It6itgTL4AT2V3_1cos5BgnD2Y_PgN2ZdkBuDuqZxe1CQqgRSKaYhXxlpI-YjCpWGMm0SAEJQvs0rC0vZTclE14z9hkKNDAVdwPB_OkLc3QOQEv4pGDDEqTB1BJql627pKbU2keeBVkjkMpHamoOs3438M0nFYgeYBKpFZyqkH0dsxAyuyo8of4"

export default function WelcomeScreen() {
  const { t } = useTranslation()
  const navigation = useNavigation<WelcomeNavProp>()
  const { colors, isDark } = useThemeColors()

  const onStart = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      }),
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView
        style={{ flex: 1 }}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.heroPad}>
            <ImageBackground
              source={{ uri: BG_URI }}
              resizeMode="cover"
              imageStyle={styles.heroImage}
              style={styles.hero}
            />
          </View>

          <View style={styles.copyWrap}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("welcome.title")}
            </Text>

            <Text style={[styles.subtitle, { color: colors.subText }]}>
              {t("welcome.subtitle")}
            </Text>
          </View>
        </View>

        <View style={styles.ctaWrap}>
          <PrimaryButton title={t("welcome.cta")} onPress={onStart} />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroPad: { paddingHorizontal: 16, paddingTop: 16 },
  hero: { width: "100%", height: 320, borderRadius: 16, overflow: "hidden" },
  heroImage: { borderRadius: 16 },
  copyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.25,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
})
