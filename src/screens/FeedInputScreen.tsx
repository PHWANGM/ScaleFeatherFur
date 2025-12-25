// src/screens/FeedInputScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  selectCurrentPetId,
  selectSelectedDate,
} from '../state/slices/petsSlice';
import {
  insertCareLog,
  type CareLogRow,
} from '../lib/db/repos/care.logs';
import { useThemeColors } from '../styles/themesColors';
import { useFoodAnalysis, useAnalysisToFormValues } from '../hooks/useFoodAnalysis';

type RootStackParamList = {
  MainTabs: { screen: 'Care' } | undefined;
};

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type NewCareLog = Omit<CareLogRow, 'id' | 'created_at' | 'updated_at'>;

const buildAtIso = (selectedDate: string | null): string => {
  if (!selectedDate) return new Date().toISOString();
  const d = new Date(selectedDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
};

const FOOD_TYPE_LABELS: Record<string, string> = {
  vegetables: '蔬菜',
  hay: '乾草',
  meat: '肉類',
  fruit: '水果',
  insects: '昆蟲',
  mixed: '混合食物',
  unknown: '未知',
};

const FeedInputScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const currentPetId = useSelector(selectCurrentPetId);
  const selectedDate = useSelector(selectSelectedDate);
  const { colors, isDark } = useThemeColors();

  const palette = {
    bg: colors.bg,
    card: colors.card,
    text: colors.text,
    subText: colors.subText ?? '#97A3B6',
    border: colors.border,
    primary: colors.primary ?? '#38e07b',
  };

  // 餵食輸入狀態
  const [vegGrams, setVegGrams] = useState('');
  const [hayGrams, setHayGrams] = useState('');
  const [meatGrams, setMeatGrams] = useState('');
  const [fruitGrams, setFruitGrams] = useState('');
  const [insectGrams, setInsectGrams] = useState('');

  const [calciumChecked, setCalciumChecked] = useState(false);
  const [vitaminChecked, setVitaminChecked] = useState(false);

  const [saving, setSaving] = useState(false);

  // AI 食物分析
  const {
    state: analysisState,
    analyzeFromCamera,
    analyzeFromLibrary,
    clearResult,
    checkApiKey,
  } = useFoodAnalysis(currentPetId);

  // 初始化時檢查 API Key
  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  // 套用 AI 分析結果到表單
  const applyAnalysisResult = useCallback(() => {
    if (!analysisState.result) return;

    const { foodType, estimatedWeightGrams } = analysisState.result;
    const weightStr = String(estimatedWeightGrams);

    // 清空所有欄位先
    setVegGrams('');
    setHayGrams('');
    setMeatGrams('');
    setFruitGrams('');
    setInsectGrams('');

    switch (foodType) {
      case 'vegetables':
        setVegGrams(weightStr);
        break;
      case 'hay':
        setHayGrams(weightStr);
        break;
      case 'meat':
        setMeatGrams(weightStr);
        break;
      case 'fruit':
        setFruitGrams(weightStr);
        break;
      case 'insects':
        setInsectGrams(weightStr);
        break;
      case 'mixed':
        Alert.alert(
          '偵測到混合食物',
          '請根據圖片內容手動分配各類食物的重量。',
          [{ text: '好的' }]
        );
        break;
      default:
        break;
    }

    // 清除分析結果
    clearResult();
  }, [analysisState.result, clearResult]);

  const handleSave = async () => {
    if (!currentPetId) {
      Alert.alert('請先選擇寵物', '目前沒有選中的寵物，無法寫入紀錄。');
      return;
    }

    const at = buildAtIso(selectedDate);
    const logs: NewCareLog[] = [];

    const veg = parseFloat(vegGrams);
    if (!Number.isNaN(veg) && veg > 0) {
      logs.push({
        pet_id: currentPetId,
        type: 'feed',
        subtype: 'feed_greens',
        category: 'feed_greens',
        value: veg,
        unit: 'g',
        note: null,
        at,
      });
    }

    const hay = parseFloat(hayGrams);
    if (!Number.isNaN(hay) && hay > 0) {
      logs.push({
        pet_id: currentPetId,
        type: 'feed',
        subtype: 'feed_hay',
        category: 'feed_hay',
        value: hay,
        unit: 'g',
        note: null,
        at,
      });
    }

    const meat = parseFloat(meatGrams);
    if (!Number.isNaN(meat) && meat > 0) {
      logs.push({
        pet_id: currentPetId,
        type: 'feed',
        subtype: 'feed_meat',
        category: 'feed_meat',
        value: meat,
        unit: 'g',
        note: null,
        at,
      });
    }

    const fruit = parseFloat(fruitGrams);
    if (!Number.isNaN(fruit) && fruit > 0) {
      logs.push({
        pet_id: currentPetId,
        type: 'feed',
        subtype: 'feed_fruit',
        category: 'feed_fruit',
        value: fruit,
        unit: 'g',
        note: null,
        at,
      });
    }

    // 新增：昆蟲
    const insect = parseFloat(insectGrams);
    if (!Number.isNaN(insect) && insect > 0) {
      logs.push({
        pet_id: currentPetId,
        type: 'feed',
        subtype: 'feed_insect',
        category: 'feed_insect',
        value: insect,
        unit: 'g',
        note: null,
        at,
      });
    }

    if (calciumChecked) {
      logs.push({
        pet_id: currentPetId,
        type: 'calcium',
        subtype: 'calcium_plain',
        category: 'supplement',
        value: 1,
        unit: 'pcs',
        note: null,
        at,
      });
    }

    if (vitaminChecked) {
      logs.push({
        pet_id: currentPetId,
        type: 'vitamin',
        subtype: 'vitamin_multi',
        category: 'supplement',
        value: 1,
        unit: 'pcs',
        note: null,
        at,
      });
    }

    if (logs.length === 0) {
      Alert.alert('尚未輸入任何資料', '請輸入餵食克數或勾選補充品。');
      return;
    }

    try {
      setSaving(true);
      for (const log of logs) {
        await insertCareLog(log);
      }

      // 清空欄位
      setVegGrams('');
      setMeatGrams('');
      setFruitGrams('');
      setInsectGrams('');
      setCalciumChecked(false);
      setVitaminChecked(false);
      clearResult();

      navigation.navigate('MainTabs', { screen: 'Care' });
    } catch (err) {
      console.error('Failed to save care logs', err);
      Alert.alert('儲存失敗', '寫入資料庫時發生錯誤，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  const { result, analyzing, suggestion, error, imageUri } = analysisState;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 日期 / 狀態 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Today&apos;s Care
          </Text>
          <Text style={[styles.sectionHint, { color: palette.subText }]}>
            {selectedDate ?? '使用今日日期'}
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
            <View style={[styles.cardIconBox, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
              <Feather name="camera" size={20} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                AI Food Analysis
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                拍照自動辨識食物類型與重量
              </Text>
            </View>
          </View>

          {/* 相機/相簿按鈕 */}
          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.analysisButton,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' },
              ]}
              onPress={analyzeFromCamera}
              disabled={analyzing}
            >
              <Feather name="camera" size={18} color="#6366f1" />
              <Text style={[styles.analysisButtonText, { color: '#6366f1' }]}>
                拍照
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.analysisButton,
                { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)' },
              ]}
              onPress={analyzeFromLibrary}
              disabled={analyzing}
            >
              <Feather name="image" size={18} color="#6366f1" />
              <Text style={[styles.analysisButtonText, { color: '#6366f1' }]}>
                相簿
              </Text>
            </Pressable>
          </View>

          {/* 分析中狀態 */}
          {analyzing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={[styles.loadingText, { color: palette.subText }]}>
                AI 分析中...
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
                  <Text style={[styles.resultLabel, { color: palette.subText }]}>
                    偵測到：
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {FOOD_TYPE_LABELS[result.foodType] ?? result.foodType}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: palette.subText }]}>
                    估計重量：
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {result.estimatedWeightGrams}g
                  </Text>
                </View>
                {result.identifiedItems.length > 0 && (
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, { color: palette.subText }]}>
                      識別項目：
                    </Text>
                    <Text style={[styles.resultValue, { color: palette.text }]}>
                      {result.identifiedItems.slice(0, 3).join(', ')}
                    </Text>
                  </View>
                )}
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: palette.subText }]}>
                    信心度：
                  </Text>
                  <Text style={[styles.resultValue, { color: palette.text }]}>
                    {Math.round(result.confidence * 100)}%
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.applyButton, { backgroundColor: palette.primary }]}
                onPress={applyAnalysisResult}
              >
                <Feather name="check" size={16} color="#022c22" />
                <Text style={styles.applyButtonText}>套用到表單</Text>
              </Pressable>
            </View>
          )}

          {/* 營養建議 */}
          {suggestion && !analyzing && (
            <View style={[styles.suggestionContainer, { backgroundColor: isDark ? 'rgba(56,224,123,0.1)' : 'rgba(56,224,123,0.08)' }]}>
              <View style={styles.suggestionHeader}>
                <MaterialCommunityIcons name="lightbulb-outline" size={18} color={palette.primary} />
                <Text style={[styles.suggestionTitle, { color: palette.text }]}>
                  營養建議
                </Text>
              </View>
              <Text style={[styles.suggestionMessage, { color: palette.text }]}>
                {suggestion.message}
              </Text>
              {suggestion.details && (
                <Text style={[styles.suggestionDetails, { color: palette.subText }]}>
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
                  {suggestion.tips.map((t, i) => (
                    <Text key={i} style={[styles.tipItem, { color: palette.subText }]}>
                      {t}
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
            { backgroundColor: palette.card, borderColor: palette.border, marginTop: 16 },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Feather name="edit-3" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                Feeding
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                記錄餵食量（g）
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              蔬菜 / 葉菜
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
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
              乾草
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  },
                ]}
                keyboardType="numeric"
                value={hayGrams}
                onChangeText={setHayGrams}
                placeholder="0"
                placeholderTextColor={palette.subText}
              />
              <Text style={[styles.unit, { color: palette.subText }]}>g</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              肉類
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
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
              昆蟲
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  },
                ]}
                keyboardType="numeric"
                value={insectGrams}
                onChangeText={setInsectGrams}
                placeholder="0"
                placeholderTextColor={palette.subText}
              />
              <Text style={[styles.unit, { color: palette.subText }]}>g</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              水果
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: palette.text,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
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
              style={[
                styles.cardIconBox,
                { backgroundColor: 'rgba(56,224,123,0.12)' },
              ]}
            >
              <MaterialCommunityIcons
                name="pill"
                size={20}
                color={palette.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                Supplements
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                補鈣 / 維他命
              </Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.text }]}>
              Calcium（補鈣）
            </Text>
            <Switch
              value={calciumChecked}
              onValueChange={setCalciumChecked}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: palette.text }]}>
              Vitamin（維他命）
            </Text>
            <Switch
              value={vitaminChecked}
              onValueChange={setVitaminChecked}
            />
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
                  : 'rgba(148,163,184,0.6)',
              },
            ]}
            disabled={saving || !currentPetId}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>
              {saving ? '儲存中...' : '儲存紀錄'}
            </Text>
          </Pressable>
          {!currentPetId && (
            <Text style={[styles.warningText, { color: '#f97316' }]}>
              提示：目前尚未選擇寵物，請先在首頁選取寵物再新增紀錄。
            </Text>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default FeedInputScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionHint: { fontSize: 14, fontWeight: '500' },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,224,123,0.18)',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 2 },

  // AI 分析按鈕
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  analysisButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  analysisButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // 載入狀態
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
  },

  // 錯誤狀態
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
  },

  // 分析結果
  resultContainer: {
    marginTop: 16,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultInfo: {
    gap: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 13,
    width: 80,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#022c22',
    fontSize: 14,
    fontWeight: '600',
  },

  // 營養建議
  suggestionContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionMessage: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionDetails: {
    fontSize: 13,
    marginTop: 4,
  },
  warningsList: {
    marginTop: 8,
  },
  warningItem: {
    fontSize: 13,
    color: '#f97316',
    marginTop: 4,
  },
  tipsList: {
    marginTop: 8,
  },
  tipItem: {
    fontSize: 12,
    marginTop: 4,
  },

  // 輸入欄位
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 110,
    justifyContent: 'flex-end',
  },
  input: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    minWidth: 50,
    textAlign: 'right',
    fontSize: 14,
  },
  unit: {
    marginLeft: 4,
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#022c22',
    fontSize: 16,
    fontWeight: '700',
  },
  warningText: {
    marginTop: 8,
    fontSize: 12,
  },
});
