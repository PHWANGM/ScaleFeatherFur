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
  getLatestWeighOnOrBefore, // ★ 新增：用來驗證最近一次體重
} from '../lib/db/repos/care.logs';
import { listPetsWithSpecies, type PetWithSpeciesRow } from '../lib/db/repos/pets.repo';

import {
  setCurrentPetId,
  selectCurrentPetId,
} from '../state/slices/petsSlice';

type Unit = 'g' | 'kg';

const WeighScreen: React.FC = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>(); // 簡化型別
  const dispatch = useDispatch();

  // Redux：目前寵物
  const reduxPetId = useSelector(selectCurrentPetId) as string | null;

  // 本地狀態
  const [pets, setPets] = useState<PetWithSpeciesRow[]>([]);
  const [petId, setPetId] = useState<string | undefined>(reduxPetId ?? undefined);
  const [petPickerOpen, setPetPickerOpen] = useState(false);

  const [weightText, setWeightText] = useState<string>('');
  const [unit, setUnit] = useState<Unit>('g');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 取得寵物清單（帶入預設 petId）
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const rows = await listPetsWithSpecies({ limit: 100, offset: 0 });
        if (!mounted) return;
        setPets(rows);

        // 如果 Redux 沒有 currentPetId，就以第一隻為預設（存在才帶）
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

  // 小工具：寬鬆解析數字
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

    // 內部統一以 kg 存入（你的 getDailyAggregatesSQL 會以 kg 讀）
    const valueKg = unit === 'g' ? n / 1000 : n;

    setIsSaving(true);
    try {
      const nowISO = new Date().toISOString();

      await insertCareLog({
        pet_id: petId,
        type: 'weigh',
        subtype: null,
        category: null,
        value: valueKg,               // 以 kg 寫入 DB
        unit,                         // 保存原始單位字串供顯示
        note: null,
        at: nowISO,                   // 總是使用「當下時間」
      });

      // ★ 方法 3：用「最近一次體重」驗證是否為剛剛那筆
      const latest = await getLatestWeighOnOrBefore(petId, new Date().toISOString());
      console.log('✅ 最新體重紀錄：', latest);
      if (!latest) {
        Alert.alert(
          '寫入疑似失敗',
          '找不到最近一次體重紀錄。請稍後再試或檢查資料庫連線。'
        );
        return;
      }

      // 若需要更嚴謹的驗證，可比較時間差與數值
      const ok =
        floatEq((latest.value ?? 0), valueKg) ||
        (latest.at && latest.at >= nowISO); // 基本合理性檢查

      const confirmMessage =
        `最近一次體重：${(latest.value ?? 0).toFixed(3)} kg\n時間：${latest.at}`;

      if (!ok) {
        Alert.alert(
          '寫入結果不一致',
          `期望值：${valueKg} kg\n${confirmMessage}\n\n（提示：可能是時間精度或其他流程寫入）`
        );
        return;
      }

      // ✅ 成功：彈出確認，按下 OK 後導回 LogsScreen（MainTabs 的 Care 分頁）
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.container}
      >
        <Text style={styles.title}>體重記錄</Text>

        {/* 寵物選擇 */}
        <View style={styles.section}>
          <Text style={styles.label}>寵物</Text>
          <Pressable
            style={styles.selector}
            onPress={() => setPetPickerOpen(true)}
            disabled={isLoading}
          >
            <Text style={styles.selectorText}>
              {selectedPet ? displayPet(selectedPet) : isLoading ? '載入中…' : '請選擇寵物'}
            </Text>
          </Pressable>
        </View>

        {/* 體重輸入 */}
        <View style={styles.section}>
          <Text style={styles.label}>體重</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={weightText}
              onChangeText={setWeightText}
              inputMode="decimal"
              keyboardType="decimal-pad"
              placeholder={unit === 'g' ? '例如 123' : '例如 0.12'}
              placeholderTextColor="#999"
            />
            <View style={{ width: 12 }} />
            <Segmented
              value={unit}
              options={[
                { label: 'g', value: 'g' },
                { label: 'kg', value: 'kg' },
              ]}
              onChange={(v) => setUnit(v as Unit)}
            />
          </View>
          <Text style={styles.help}>
            會以 <Text style={styles.helpStrong}>kg</Text> 儲存到資料庫（欄位 <Text style={styles.mono}>value</Text>），
            但 <Text style={styles.mono}>unit</Text> 會保存你選擇的單位做為顯示用途。
          </Text>
          <Text style={[styles.help, { marginTop: 2 }]}>
            記錄時間固定為儲存當下。
          </Text>
        </View>

        {/* 儲存 */}
        <TouchableOpacity
          style={[styles.button, styles.saveButton, (isSaving || !petId) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving || !petId}
        >
          <Text style={styles.buttonText}>{isSaving ? '儲存中…' : '儲存記錄'}</Text>
        </TouchableOpacity>

        {/* 寵物選擇 Modal */}
        <Modal
          visible={petPickerOpen}
          animationType="slide"
          onRequestClose={() => setPetPickerOpen(false)}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>選擇寵物</Text>
              <TouchableOpacity onPress={() => setPetPickerOpen(false)}>
                <Text style={styles.modalClose}>關閉</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pets}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.petRow}
                  onPress={() => {
                    setPetId(item.id);
                    dispatch(setCurrentPetId(item.id));
                    setPetPickerOpen(false);
                  }}
                >
                  <View style={styles.petAvatar}>
                    <Text style={styles.petAvatarText}>
                      {item.name?.[0]?.toUpperCase() ?? 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.petName}>{item.name}</Text>
                    <Text style={styles.petSub}>
                      {item.species_name ?? item.species_key}
                    </Text>
                  </View>
                  {item.id === petId && <Text style={styles.petCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 16 }}>
                  <Text>尚無寵物，請先建立寵物資料。</Text>
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

/** 極簡 Segmented Control（不依賴額外套件） */
const Segmented: React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => {
  return (
    <View style={styles.segmented}>
      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.segment,
              active && styles.segmentActive,
              idx === 0 && styles.segmentLeft,
              idx === options.length - 1 && styles.segmentRight,
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  container: { flex: 1, padding: 16, gap: 16 },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },

  section: { gap: 8 },
  label: { color: '#bbb', fontSize: 13 },
  selector: {
    backgroundColor: '#16171a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2e33',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  selectorText: { color: 'white', fontSize: 16 },

  row: { flexDirection: 'row', alignItems: 'center' },

  input: {
    backgroundColor: '#16171a',
    color: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2e33',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#4b8cff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },

  saveButton: { marginTop: 6 },
  buttonDisabled: { opacity: 0.5 },

  help: { color: '#9aa0a6', fontSize: 12, marginTop: 6, lineHeight: 18 },
  helpStrong: { color: '#e3e3e3', fontWeight: '700' },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    color: '#e3e3e3',
  },

  modalSafe: { flex: 1, backgroundColor: '#0b0b0c' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomColor: '#2c2e33',
    borderBottomWidth: 1,
  },
  modalTitle: { color: 'white', fontWeight: '700', fontSize: 18, flex: 1 },
  modalClose: { color: '#8ab4f8', fontWeight: '600', fontSize: 16 },

  petRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  sep: { height: 1, backgroundColor: '#1d1f24' },
  petAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#23252b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#30333a',
  },
  petAvatarText: { color: '#cbd5e1', fontWeight: '700' },
  petName: { color: 'white', fontWeight: '700' },
  petSub: { color: '#9aa0a6', fontSize: 12, marginTop: 2 },
  petCheck: { color: '#8ab4f8', fontSize: 18 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: '#16171a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2e33',
    overflow: 'hidden',
  },
  segment: { paddingHorizontal: 14, paddingVertical: 10 },
  segmentLeft: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  segmentRight: { borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  segmentActive: { backgroundColor: '#2b2f36' },
  segmentText: { color: '#aeb4bd', fontWeight: '600' },
  segmentTextActive: { color: 'white' },
});

export default WeighScreen;
