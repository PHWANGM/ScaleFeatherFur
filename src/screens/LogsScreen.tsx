// src/screens/LogsScreen.tsx
import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useDispatch, useSelector } from "react-redux"
import { useTranslation } from "react-i18next"

import CustomCalendar from "../components/calendar/CustomCalendar"
import CalendarDateDetail from "../components/calendar/CalendarDateDetail"
import PetsHeader from "../components/headers/PetsHeader"

import {
  selectCurrentPetId,
  selectSelectedDate,
  setCurrentPetId,
  setSelectedDate,
} from "../state/slices/petsSlice"
import { query } from "../lib/db/db.client"

type ActivitiesProps = {
  route?: { params?: { redirectToNewActivity?: boolean } }
  navigation: {
    setParams: (params: Record<string, unknown>) => void
    navigate: (screen: string, params?: Record<string, unknown>) => void
  }
}

function Activities({ route, navigation }: ActivitiesProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const isRedirect = route?.params?.redirectToNewActivity === true

  const currentPetId = useSelector(selectCurrentPetId)
  const selectedDate = useSelector(selectSelectedDate)

  useFocusEffect(
    useCallback(() => {
      // 1) 確保 selectedDate（用本地現在）
      if (!selectedDate) {
        dispatch(setSelectedDate(new Date().toISOString()))
      } // 2) 確保 currentPetId（若還沒有，從 DB 撈第一筆）

      ;(async () => {
        try {
          if (!currentPetId) {
            const rows = await query<{ id: string }>(
              `SELECT id FROM pets ORDER BY created_at ASC LIMIT 1`,
              [],
            )
            if (rows[0]?.id) {
              dispatch(setCurrentPetId(rows[0].id))
            }
          }
        } catch (e) {
          console.warn(t("logs.warnings.bootstrapPetFailed"), e)
        }
      })()

      // 3) 原本的 redirect 流程
      if (isRedirect) {
        navigation.setParams({ redirectToNewActivity: false })
        navigation.navigate("Activities", { screen: "NewActivity" })
      }
    }, [isRedirect, navigation, currentPetId, selectedDate, dispatch, t]),
  )

  // ✅ 若還沒有 currentPetId（DB 還沒撈到，或真的沒有寵物），給一個可翻譯的空狀態
  if (!currentPetId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.activityContainer}>
          <PetsHeader />
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t("logs.empty.title")}</Text>
            <Text style={styles.emptySubtitle}>{t("logs.empty.subtitle")}</Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.activityContainer}>
        <PetsHeader />
        <View style={styles.calendar}>
          <CustomCalendar />
        </View>
        <View style={styles.date}>
          <CalendarDateDetail />
        </View>
      </View>
    </SafeAreaView>
  )
}

export default Activities

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  activityContainer: { flex: 1, alignItems: "center", width: "100%" },
  calendar: { flexShrink: 1, width: "100%" },
  date: { flex: 1, width: "100%" },

  emptyWrap: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2D3748",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#4A5568",
    textAlign: "center",
  },
})
