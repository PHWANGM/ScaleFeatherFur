// src/screens/FeedInputScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
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

// 依你的 root stack 需求微調這個 ParamList 即可
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

  const [vegGrams, setVegGrams] = useState('');
  const [meatGrams, setMeatGrams] = useState('');
  const [fruitGrams, setFruitGrams] = useState('');

  const [calciumChecked, setCalciumChecked] = useState(false);
  const [vitaminChecked, setVitaminChecked] = useState(false);

  const [saving, setSaving] = useState(false);

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
      setCalciumChecked(false);
      setVitaminChecked(false);

      // 儲存成功後導回 Care 分頁
      navigation.navigate('MainTabs', { screen: 'Care' });
    } catch (err) {
      console.error('Failed to save care logs', err);
      Alert.alert('儲存失敗', '寫入資料庫時發生錯誤，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* ❌ 不需要 Header，直接內容 */}
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

        {/* 🥗 Feeding Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, borderColor: palette.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardIconBox}>
              <Feather name="cloud" size={20} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                Feeding
              </Text>
              <Text style={[styles.cardSub, { color: palette.subText }]}>
                記錄今天蔬菜 / 肉 / 水果的餵食量（g）
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: palette.text }]}>
              蔬菜 / 葉菜 (veg)
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
              肉類 (meat)
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
              水果 (fruit)
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

        {/* 💊 Supplements Card */}
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
                補鈣 / 維他命，一次勾選代表一次補充
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
              {saving ? '儲存中…' : '儲存紀錄'}
            </Text>
          </Pressable>
          {!currentPetId && (
            <Text style={[styles.warning, { color: '#f97316' }]}>
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

/* 🧱 Styles（延續 HomeScreen 的風格） */
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
  warning: {
    marginTop: 8,
    fontSize: 12,
  },
});
