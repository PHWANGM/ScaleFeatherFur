// src/screens/WeighScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import {
  insertCareLog,
  getLatestWeighOnOrBefore,
} from '../lib/db/repos/care.logs';
import { listPetsWithSpecies, type PetWithSpeciesRow } from '../lib/db/repos/pets.repo';

import {
  setCurrentPetId,
  selectCurrentPetId,
} from '../state/slices/petsSlice';

import PrimaryButton from '../components/buttons/PrimaryButton';
// 🆕 使用主題顏色
import { useThemeColors } from '../styles/themesColors';

type Unit = 'g' | 'kg';

const WeighScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const reduxPetId = useSelector(selectCurrentPetId) as string | null;

  const [pets, setPets] = useState<PetWithSpeciesRow[]>([]);
  const [petId, setPetId] = useState<string | undefined>(reduxPetId ?? undefined);
  const [petPickerOpen, setPetPickerOpen] = useState(false);

  const [weightText, setWeightText] = useState<string>('');
  const [unit, setUnit] = useState<Unit>('g');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 🆕 取得 theme 顏色
  const { colors } = useThemeColors();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const rows = await listPetsWithSpecies({ limit: 100, offset: 0 });
        if (!mounted) return;
        setPets(rows);

        if (!reduxPetId && rows.length > 0) {
          setPetId(rows[0].id);
        } else {
          setPetId(reduxPetId ?? undefined);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('讀取失敗', '無法載入寵物清單。');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isFocused, reduxPetId]);

  const selectedPet = useMemo(
    () => pets.find(p => p.id === petId),
    [pets, petId]
  );

  function parseNumberLoose(s: string): number | null {
    if (!s) return null;
    const n = Number(s.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function floatEq(a: number, b: number, eps = 1e-6) {
    return Math.abs(a - b) <= eps;
  }

  async function handleSave() {
    if (!petId) {
      Alert.alert('請選擇寵物', '你尚未選擇要記錄的寵物。');
      return;
    }
    const n = parseNumberLoose(weightText);
    if (n === null || n <= 0) {
      Alert.alert('體重數值不正確', '請輸入大於 0 的數值。');
      return;
    }

    const valueKg = unit === 'g' ? n / 1000 : n;

    setIsSaving(true);
    try {
      const nowISO = new Date().toISOString();

      await insertCareLog({
        pet_id: petId,
        type: 'weigh',
        subtype: null,
        category: null,
        value: valueKg,
        unit,
        note: null,
        at: nowISO,
      });

      const latest = await getLatestWeighOnOrBefore(petId, new Date().toISOString());
      console.log('✅ 最新體重紀錄：', latest);
      if (!latest) {
        Alert.alert(
          '寫入疑似失敗',
          '找不到最近一次體重紀錄。請稍後再試或檢查資料庫連線。'
        );
        return;
      }

      const ok =
        floatEq((latest.value ?? 0), valueKg) ||
        (latest.at && latest.at >= nowISO);

      const confirmMessage =
        `最近一次體重：${(latest.value ?? 0).toFixed(3)} kg\n時間：${latest.at}`;

      if (!ok) {
        Alert.alert(
          '寫入結果不一致',
          `期望值：${valueKg} kg\n${confirmMessage}\n\n（提示：可能是時間精度或其他流程寫入）`
        );
        return;
      }

      Alert.alert('已儲存', confirmMessage, [
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('MainTabs', { screen: 'Care' });
          },
        },
      ]);

      setWeightText('');
    } catch (err) {
      console.error(err);
      Alert.alert('儲存失敗', '寫入資料庫時發生問題。');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.container}
      >
        <Text style={[styles.title, { color: colors.text }]}>體重記錄</Text>

        {/* 寵物選擇 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>寵物</Text>
          <Pressable
            style={[
              styles.selector,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setPetPickerOpen(true)}
            disabled={isLoading}
          >
            <Text style={[styles.selectorText, { color: colors.text }]}>
              {selectedPet ? displayPet(selectedPet) : isLoading ? '載入中…' : '請選擇寵物'}
            </Text>
          </Pressable>
        </View>

        {/* 體重輸入 */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>體重</Text>
          <View style={styles.row}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={weightText}
              onChangeText={setWeightText}
              inputMode="decimal"
              keyboardType="decimal-pad"
              placeholder={unit === 'g' ? '例如 123' : '例如 0.12'}
              placeholderTextColor={colors.subText}
            />
            <View style={{ width: 12 }} />
            <Segmented
              value={unit}
              options={[
                { label: 'g', value: 'g' },
                { label: 'kg', value: 'kg' },
              ]}
              onChange={(v) => setUnit(v as Unit)}
              // 🆕 把顏色往下傳
              colors={colors}
            />
          </View>
        </View>

        {/* 儲存（PrimaryButton 已經使用 theme） */}
        <PrimaryButton
          title={isSaving ? '儲存中…' : '儲存記錄'}
          onPress={handleSave}
          disabled={isSaving || !petId}
          loading={isSaving}
          style={styles.saveButton}
        />

        {/* 寵物選擇 Modal */}
        <Modal
          visible={petPickerOpen}
          animationType="slide"
          onRequestClose={() => setPetPickerOpen(false)}
        >
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.bg }]}>
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>選擇寵物</Text>
              <TouchableOpacity onPress={() => setPetPickerOpen(false)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>關閉</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pets}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => (
                <View style={[styles.sep, { backgroundColor: colors.card }]} />
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.petRow}
                  onPress={() => {
                    setPetId(item.id);
                    dispatch(setCurrentPetId(item.id));
                    setPetPickerOpen(false);
                  }}
                >
                  <View
                    style={[
                      styles.petAvatar,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.petAvatarText, { color: colors.text }]}>
                      {item.name?.[0]?.toUpperCase() ?? 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.petName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.petSub, { color: colors.subText }]}>
                      {item.species_name ?? item.species_key}
                    </Text>
                  </View>
                  {item.id === petId && (
                    <Text style={[styles.petCheck, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 16 }}>
                  <Text style={{ color: colors.text }}>尚無寵物，請先建立寵物資料。</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function displayPet(p: PetWithSpeciesRow) {
  const species = p.species_name ?? p.species_key ?? '';
  return species ? `${p.name}（${species}）` : p.name;
}

/** 🆕 Segmented 多帶一個 colors 進來，讓它也吃 theme */
const Segmented: React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
}> = ({ value, options, onChange, colors }) => {
  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.segment,
              active && { backgroundColor: colors.primary },
              idx === 0 && styles.segmentLeft,
              idx === options.length - 1 && styles.segmentRight,
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.bg : colors.subText },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700' },

  section: { gap: 8 },
  label: { fontSize: 13 },
  selector: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  selectorText: { fontSize: 16 },

  row: { flexDirection: 'row', alignItems: 'center' },

  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },

  // button 樣式保留給其他地方用（目前 PrimaryButton 處理顏色）
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { fontWeight: '700', fontSize: 16 },

  saveButton: { marginTop: 6 },
  buttonDisabled: { opacity: 0.5 },

  help: { fontSize: 12, marginTop: 6, lineHeight: 18 },
  helpStrong: { fontWeight: '700' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontWeight: '700', fontSize: 18, flex: 1 },
  modalClose: { fontWeight: '600', fontSize: 16 },

  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sep: { height: 1 },
  petAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  petAvatarText: { fontWeight: '700' },
  petName: { fontWeight: '700' },
  petSub: { fontSize: 12, marginTop: 2 },
  petCheck: { fontSize: 18 },

  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segment: { paddingHorizontal: 14, paddingVertical: 10 },
  segmentLeft: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  segmentRight: { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  segmentText: { fontWeight: '600' },
});

export default WeighScreen;
