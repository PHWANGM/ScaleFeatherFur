// src/screens/PetDetailScreen.tsx
import { useEffect, useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "react-i18next"

import ChartLineWeight from "../components/charts/ChartLineWeight"
import Card from "../components/cards/Card"
import EmptyState from "../components/EmptyState"
import { theme } from "../styles/tokens"
import { AppDispatch, RootState } from "../state/store"
import { loadLogsByPet } from "../state/slices/logsSlice"
import type { CareLogType } from "../lib/db/repos/care.logs"

export default function PetDetailScreen({ route }: any) {
  const { t } = useTranslation()

  const pet = route.params.pet as { id: string; name: string }
  const dispatch = useDispatch<AppDispatch>()
  const logs = useSelector((s: RootState) => s.logs.byPet[pet.id] ?? [])

  useEffect(() => {
    dispatch(loadLogsByPet({ petId: pet.id }))
  }, [dispatch, pet.id])

  const weightSeries = useMemo(() => {
    const list = logs
      .filter((l) => l.type === "weigh" && typeof l.value === "number")
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((l, i) => ({ x: i, y: Number(l.value) }))
    return list
  }, [logs])

  const completion7d = useMemo(() => {
    const now = new Date()
    let total = 0,
      done = 0

    // ✅ 關鍵：用聯集字面量型別，避免被推斷成 string[]
    const keys: CareLogType[] = [
      "feed",
      "calcium",
      "uvb",
      "clean",
      "weigh",
      "vitamin",
    ]

    for (let i = 0; i < 7; i++) {
      const day = new Date(now.getTime() - i * 86400000).toISOString().slice(
        0,
        10,
      )
      total += keys.length
      const set = new Set(
        logs.filter((l) => l.at.startsWith(day)).map((l) => l.type),
      )
      done += keys.filter((k) => set.has(k)).length
    }
    return Math.round((done / total) * 100)
  }, [logs])

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>{pet.name}</Text>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <Text style={styles.h2}>{t("petDetail.weightTrend.title")}</Text>
        <View style={{ height: theme.spacing.md }} />
        {weightSeries.length >= 2
          ? <ChartLineWeight data={weightSeries} width={340} height={140} />
          : (
            <EmptyState
              title={t("petDetail.weightTrend.emptyTitle")}
              hint={t("petDetail.weightTrend.emptyHint")}
            />
          )}
      </Card>

      <Card style={{ marginTop: theme.spacing.lg }}>
        <Text style={styles.h2}>{t("petDetail.completion7d.title")}</Text>
        <View style={{ height: theme.spacing.md }} />
        <Text style={styles.percent}>{completion7d}%</Text>
        <Text style={styles.hint}>{t("petDetail.completion7d.hint")}</Text>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.xl,
  },
  h1: { ...theme.typography.h1, color: theme.colors.text },
  h2: { ...theme.typography.h2, color: theme.colors.text },
  percent: { ...theme.typography.h1, color: theme.colors.accent },
  hint: { ...theme.typography.small },
})
