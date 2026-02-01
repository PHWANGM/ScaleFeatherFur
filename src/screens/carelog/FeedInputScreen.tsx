// src/screens/FeedInputScreen.tsx
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useSelector } from "react-redux"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTranslation } from "react-i18next"

import {
  selectCurrentPetId,
  selectSelectedDate,
} from "../../state/slices/petsSlice"
import { type CareLogRow, insertCareLog } from "../../lib/db/repos/care.logs"
import { useThemeColors } from "../../styles/themesColors"
import { useFoodAnalysis } from "../../hooks/useFoodAnalysis"

type RootStackParamList = {
  MainTabs: { screen: "Care" } | undefined
}

type Navigation = NativeStackNavigationProp<RootStackParamList>
type NewCareLog = Omit<CareLogRow, "id" | "created_at" | "updated_at">

const buildAtIso = (selectedDate: string | null): string => {
  if (!selectedDate) return new Date().toISOString()
  const d = new Date(selectedDate)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

const FeedInputScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigation = useNavigation<Navigation>()
  const currentPetId = useSelector(selectCurrentPetId)
  const selectedDate = useSelector(selectSelectedDate)
  const { colors, isDark } = useThemeColors()

  const palette = useMemo(() => ({
    bg: colors.bg,
    card: colors.card,
    text: colors.text,
    subText: colors.subText ?? "#97A3B6",
    border: colors.border,
    primary: colors.primary ?? "#38e07b",
  }), [colors])

  // 餵食輸入狀態
  const [vegGrams, setVegGrams] = useState("")
  const [meatGrams, setMeatGrams] = useState("")
  const [fruitGrams, setFruitGrams] = useState("")

  const [calciumChecked, setCalciumChecked] = useState(false)
  const [vitaminChecked, setVitaminChecked] = useState(false)

  const [saving, setSaving] = useState(false)

  // AI 食物分析
  const {
    state: analysisState,
    analyzeFromCamera,
    analyzeFromLibrary,
    clearResult,
    checkApiKey,
  } = useFoodAnalysis(currentPetId)

  // 初始化時檢查 API Key
  useEffect(() => {
    checkApiKey()
  }, [checkApiKey])

  // food type label (i18n)
  const foodTypeLabel = useCallback((foodType?: string) => {
    const key = foodType ?? "unknown"
    return t(`carelog.feed.foodTypes.${key}`, { defaultValue: key })
  }, [t])

  // 套用 AI 分析結果到表單
  const applyAnalysisResult = useCallback(() => {
    if (!analysisState.result) return

    const { foodType, estimatedWeightGrams } = analysisState.result
    const weightStr = String(estimatedWeightGrams)

    // 清空所有欄位先
    setVegGrams("")
    setMeatGrams("")
    setFruitGrams("")

    switch (foodType) {
      case "vegetables":
        setVegGrams(weightStr)
        break
      case "meat":
        setMeatGrams(weightStr)
        break
      case "fruit":
        setFruitGrams(weightStr)
        break
      case "mixed":
        Alert.alert(
          t("carelog.feed.ai.mixedTitle"),
          t("carelog.feed.ai.mixedMessage"),
          [{ text: t("carelog.feed.ai.ok") }],
        )
        break
      default:
        break
    }

    clearResult()
  }, [analysisState.result, clearResult, t])

  const handleSave = async () => {
    if (!currentPetId) {
      Alert.alert(
        t("carelog.feed.save.noPetTitle"),
        t("carelog.feed.save.noPetMessage"),
      )
      return
    }

    const at = buildAtIso(selectedDate)
    const logs: NewCareLog[] = []

    const veg = parseFloat(vegGrams)
    if (!Number.isNaN(veg) && veg > 0) {
      logs.push({
        pet_id: currentPetId,
        type: "feed",
        subtype: "feed_greens",
        category: "feed_greens",
        value: veg,
        unit: "g",
        note: null,
        at,
      })
    }

    const meat = parseFloat(meatGrams)
    if (!Number.isNaN(meat) && meat > 0) {
      logs.push({
        pet_id: currentPetId,
        type: "feed",
        subtype: "feed_meat",
        category: "feed_meat",
        value: meat,
        unit: "g",
        note: null,
        at,
      })
    }

    const fruit = parseFloat(fruitGrams)
    if (!Number.isNaN(fruit) && fruit > 0) {
      logs.push({
        pet_id: currentPetId,
        type: "feed",
        subtype: "feed_fruit",
        category: "feed_fruit",
        value: fruit,
        unit: "g",
        note: null,
        at,
      })
    }

    if (calciumChecked) {
      logs.push({
        pet_id: currentPetId,
        type: "calcium",
        subtype: "calcium_plain",
        category: "supplement",
        value: 1,
        unit: "pcs",
        note: null,
        at,
      })
    }

    if (vitaminChecked) {
      logs.push({
        pet_id: currentPetId,
        type: "vitamin",
        subtype: "vitamin_multi",
        category: "supplement",
        value: 1,
        unit: "pcs",
        note: null,
        at,
      })
    }

    if (logs.length === 0) {
      Alert.alert(
        t("carelog.feed.save.noInputTitle"),
        t("carelog.feed.save.noInputMessage"),
      )
      return
    }

    try {
      setSaving(true)
      for (const log of logs) {
        await insertCareLog(log)
      }

      // 清空欄位
      setVegGrams("")
      setMeatGrams("")
      setFruitGrams("")
      setCalciumChecked(false)
      setVitaminChecked(false)
      clearResult()

      navigation.navigate("MainTabs", { screen: "Care" })
    } catch (err) {
      console.error("Failed to save care logs", err)
      Alert.alert(
        t("carelog.feed.save.failedTitle"),
        t("carelog.feed.save.failedMessage"),
      )
    } finally {
      setSaving(false)
    }
  }

  const { result, analyzing, suggestion, error, imageUri } = analysisState

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 日期 / 狀態 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {t("carelog.feed.headerTitle")}
          </Text>
          <Text style={[styles.sectionHint, { color: palette.subText }]}>
            {selectedDate ?? t("carelog.feed.headerDateFallback")}
          </Text>
        </View>

        {/* AI 食物分析卡片 */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View
              style={[styles.cardIconBox, {
                backgroundColor: "rgba(99,102,241,0.15)",
              }]}
            >
              <Feather name="camera" size={20} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {t("carelog.feed.ai.title")}
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                {t("carelog.feed.ai.subtitle")}
              </Text>
            </View>
          </View>

          {/* 相機/相簿按鈕 */}
          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.analysisButton,
                {
                  backgroundColor: isDark
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(99,102,241,0.1)",
                },
              ]}
              onPress={analyzeFromCamera}
              disabled={analyzing}
            >
              <Feather name="camera" size={18} color="#6366f1" />
              <Text style={[styles.analysisButtonText, { color: "#6366f1" }]}>
                {t("carelog.feed.ai.camera")}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.analysisButton,
                {
                  backgroundColor: isDark
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(99,102,241,0.1)",
                },
              ]}
              onPress={analyzeFromLibrary}
              disabled={analyzing}
            >
              <Feather name="image" size={18} color="#6366f1" />
              <Text style={[styles.analysisButtonText, { color: "#6366f1" }]}>
                {t("carelog.feed.ai.library")}
              </Text>
            </Pressable>
          </View>

          {/* 分析中狀態 */}
          {analyzing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={[styles.loadingText, { color: palette.subText }]}>
                {t("carelog.feed.ai.analyzing")}
              </Text>
            </View>
          )}

          {/* 錯誤訊息 */}
          {error && !analyzing && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 分析結果 */}
          {result && !analyzing && (
            <View style={styles.resultContainer}>
              {imageUri && (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              )}

              <View style={styles.resultInfo}>
                <View style={styles.resultRow}>
                  <Text
                    style={[styles.resultLabel, { color: palette.subText }]}
                  >
                    {t("carelog.feed.ai.detected")}
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {foodTypeLabel(result.foodType)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text
                    style={[styles.resultLabel, { color: palette.subText }]}
                  >
                    {t("carelog.feed.ai.estimatedWeight")}
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {result.estimatedWeightGrams}g
                  </Text>
                </View>

                {result.identifiedItems.length > 0 && (
                  <View style={styles.resultRow}>
                    <Text
                      style={[styles.resultLabel, { color: palette.subText }]}
                    >
                      {t("carelog.feed.ai.identifiedItems")}
                    </Text>
                    <Text style={[styles.resultValue, { color: palette.text }]}>
                      {result.identifiedItems.slice(0, 3).join(", ")}
                    </Text>
                  </View>
                )}

                <View style={styles.resultRow}>
                  <Text
                    style={[styles.resultLabel, { color: palette.subText }]}
                  >
                    {t("carelog.feed.ai.confidence")}
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {Math.round(result.confidence * 100)}%
                  </Text>
                </View>
              </View>

              <Pressable
                style={[styles.applyButton, {
                  backgroundColor: palette.primary,
                }]}
                onPress={applyAnalysisResult}
              >
                <Feather name="check" size={16} color="#022c22" />
                <Text style={styles.applyButtonText}>
                  {t("carelog.feed.ai.apply")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* 營養建議（這段多半是 AI 回傳內容，不強制翻譯；只翻譯標題） */}
          {suggestion && !analyzing && (
            <View
              style={[
                styles.suggestionContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(56,224,123,0.1)"
                    : "rgba(56,224,123,0.08)",
                },
              ]}
            >
              <View style={styles.suggestionHeader}>
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={18}
                  color={palette.primary}
                />
                <Text style={[styles.suggestionTitle, { color: palette.text }]}>
                  {t("carelog.feed.aiSuggestionTitle", {
                    defaultValue: "Nutrition tips",
                  })}
                </Text>
              </View>

              <Text style={[styles.suggestionMessage, { color: palette.text }]}>
                {suggestion.message}
              </Text>

              {suggestion.details && (
                <Text
                  style={[styles.suggestionDetails, { color: palette.subText }]}
                >
                  {suggestion.details}
                </Text>
              )}

              {suggestion.warnings.length > 0 && (
                <View style={styles.warningsList}>
                  {suggestion.warnings.map((w, i) => (
                    <Text key={i} style={styles.warningItem}>
                      {w}
                    </Text>
                  ))}
                </View>
              )}

              {suggestion.tips.length > 0 && (
                <View style={styles.tipsList}>
                  {suggestion.tips.map((tip, i) => (
                    <Text
                      key={i}
                      style={[styles.tipItem, { color: palette.subText }]}
                    >
                      {tip}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Feeding Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              marginTop: 16,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Feather name="edit-3" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {t("carelog.feed.form.title")}
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                {t("carelog.feed.form.subtitle")}
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              {t("carelog.feed.form.veg")}
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#ffffff",
                  },
                ]}
                keyboardType="numeric"
                value={vegGrams}
                onChangeText={setVegGrams}
                placeholder="0"
                placeholderTextColor={palette.subText}
              />
              <Text style={[styles.unit, { color: palette.subText }]}>g</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              {t("carelog.feed.form.meat")}
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#ffffff",
                  },
                ]}
                keyboardType="numeric"
                value={meatGrams}
                onChangeText={setMeatGrams}
                placeholder="0"
                placeholderTextColor={palette.subText}
              />
              <Text style={[styles.unit, { color: palette.subText }]}>g</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              {t("carelog.feed.form.fruit")}
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "#ffffff",
                  },
                ]}
                keyboardType="numeric"
                value={fruitGrams}
                onChangeText={setFruitGrams}
                placeholder="0"
                placeholderTextColor={palette.subText}
              />
              <Text style={[styles.unit, { color: palette.subText }]}>g</Text>
            </View>
          </View>
        </View>

        {/* Supplements Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              marginTop: 16,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View
              style={[styles.cardIconBox, {
                backgroundColor: "rgba(56,224,123,0.12)",
              }]}
            >
              <MaterialCommunityIcons
                name="pill"
                size={20}
                color={palette.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                {t("carelog.feed.supplements.title")}
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                {t("carelog.feed.supplements.subtitle")}
              </Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.text }]}>
              {t("carelog.feed.supplements.calcium")}
            </Text>
            <Switch value={calciumChecked} onValueChange={setCalciumChecked} />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.text }]}>
              {t("carelog.feed.supplements.vitamin")}
            </Text>
            <Switch value={vitaminChecked} onValueChange={setVitaminChecked} />
          </View>
        </View>

        {/* 儲存按鈕 */}
        <View style={{ marginTop: 24 }}>
          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: currentPetId
                  ? palette.primary
                  : "rgba(148,163,184,0.6)",
              },
            ]}
            disabled={saving || !currentPetId}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>
              {saving
                ? t("carelog.feed.save.saving")
                : t("carelog.feed.save.button")}
            </Text>
          </Pressable>

          {!currentPetId && (
            <Text style={[styles.warningText, { color: "#f97316" }]}>
              {t("carelog.feed.save.noPetHint")}
            </Text>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

export default FeedInputScreen

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
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
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,224,123,0.18)",
  },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSub: { fontSize: 12, marginTop: 2 },

  buttonRow: { flexDirection: "row", gap: 12 },
  analysisButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  analysisButtonText: { fontSize: 14, fontWeight: "600" },

  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  loadingText: { fontSize: 14 },

  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 8,
  },
  errorText: { flex: 1, color: "#ef4444", fontSize: 13 },

  resultContainer: { marginTop: 16 },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultInfo: { gap: 4 },
  resultRow: { flexDirection: "row", alignItems: "center" },
  resultLabel: { fontSize: 13, width: 96 },
  resultValue: { fontSize: 14, fontWeight: "500", flex: 1 },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: { color: "#022c22", fontSize: 14, fontWeight: "600" },

  suggestionContainer: { marginTop: 16, padding: 12, borderRadius: 8 },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: { fontSize: 14, fontWeight: "600" },
  suggestionMessage: { fontSize: 14, fontWeight: "500" },
  suggestionDetails: { fontSize: 13, marginTop: 4 },
  warningsList: { marginTop: 8 },
  warningItem: { fontSize: 13, color: "#f97316", marginTop: 4 },
  tipsList: { marginTop: 8 },
  tipItem: { fontSize: 12, marginTop: 4 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  label: { flex: 1, fontSize: 14, fontWeight: "500" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148,163,184,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 110,
    justifyContent: "flex-end",
  },
  input: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    minWidth: 50,
    textAlign: "right",
    fontSize: 14,
  },
  unit: { marginLeft: 4, fontSize: 12 },

  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  switchLabel: { fontSize: 14, fontWeight: "500" },

  saveButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#022c22", fontSize: 16, fontWeight: "700" },
  warningText: { marginTop: 8, fontSize: 12 },
})
