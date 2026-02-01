// src/components/charts/EnvironmentSection.tsx
import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import LineChart from "./LineChart"
import { useThemeColors } from "../../styles/themesColors"
import type { Next24hTempRiskResult } from "../../lib/compliance/envTempForecast.service"
import type { Next24hUvbRiskResult } from "../../lib/compliance/uvbForecast.service"

type Props = {
  locationName: string
  loading: boolean
  tempHourly: number[]
  uviHourly: number[]
  currentCloud: number | null

  /** 接下來 24h 的溫度風險（ambient_temp_c_min/max） */
  tempRisk?: Next24hTempRiskResult | null
  /** 接下來 24h 的 UVB 風險（uvb_intensity_min/max，以 uviHourly 為輸入） */
  uvbRisk?: Next24hUvbRiskResult | null
}

export default function EnvironmentSection({
  locationName,
  loading,
  tempHourly,
  uviHourly,
  currentCloud,
  tempRisk,
  uvbRisk,
}: Props) {
  const { t } = useTranslation()
  const { colors, isDark } = useThemeColors()

  const palette = {
    bg: colors.bg,
    card: colors.card,
    text: colors.text,
    subText: colors.subText ?? (colors as any).textDim ?? "#97A3B6",
    border: colors.border,
    primary: colors.primary ?? "#38e07b",
  }

  return (
    <View>
      {/* 標題列 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {t("home.environment.title")}
        </Text>
        <Text style={[styles.sectionHint, { color: palette.subText }]}>
          {locationName}
        </Text>
      </View>

      {/* 卡片本體 */}
      <View
        style={[styles.card, {
          backgroundColor: palette.card,
          borderColor: palette.border,
        }]}
      >
        {loading
          ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: palette.subText }}>
                {t("home.environment.loading")}
              </Text>
            </View>
          )
          : (
            <>
              {/* 上方：雲量 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <View
                  style={[
                    styles.alertIconBox,
                    {
                      backgroundColor: "rgba(56,224,123,0.18)",
                      marginRight: 12,
                    },
                  ]}
                >
                  <Feather name="cloud" size={22} color={palette.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {t("home.environment.cloudCoverLabel")}
                  </Text>
                  <Text
                    style={{
                      color: palette.text,
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 2,
                    }}
                  >
                    {currentCloud !== null
                      ? `${Math.round(currentCloud)}%`
                      : t("common.none")}
                  </Text>
                </View>
              </View>

              {/* 溫度與 UV 折線圖 */}
              <LineChart
                title={t("home.environment.temperature")}
                values={tempHourly}
                unit="°C"
                color={palette.primary}
                tempRisk={tempRisk}
              />
              <View style={{ height: 10 }} />
              <LineChart
                title={t("home.environment.uvIndex")}
                values={uviHourly}
                color={isDark ? "#fbbf24" : "#b45309"}
                uvbRisk={uvbRisk}
              />
            </>
          )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHint: { fontSize: 14, fontWeight: "500" },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
})
