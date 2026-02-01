// src/components/WeightTrend.tsx
import React from "react"
import { StyleSheet, Text, View } from "react-native"
import { useTranslation } from "react-i18next"

import WeightHistoryChart from "./charts/WeightHistoryChart"

type Palette = {
  card: string
  border: string
  text: string
}

type Props = {
  palette: Palette
}

export default function WeightTrend({ palette }: Props) {
  const { t } = useTranslation()

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>
        {t("home.weightTrend.title")}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            paddingVertical: 12,
            alignItems: "center",
          },
        ]}
      >
        <WeightHistoryChart />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
