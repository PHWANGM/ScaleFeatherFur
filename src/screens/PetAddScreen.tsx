// src/screens/PetsAddScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  NavigationProp,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import {
  insertPet,
  updatePet,
  getPetById,
  type PetInsert,
  type PetUpdate,
  type Habitat,
} from '../lib/db/repos/pets.repo';
import { listSpecies, type SpeciesRow } from '../lib/db/repos/species.repo';
import Field from '../components/fields/Field';
import { useImagePicker } from '../lib/ui/useImagePicker';
import { useThemeColors } from '../styles/themesColors';
import PrimaryButton from '../components/buttons/PrimaryButton';

// === 本畫面路由參數（可同時當作新增/編輯頁） ===
type LocalStackParamList = {
  PetsAdd: { id?: string } | undefined; // 帶 id 表示編輯模式，不帶表示新增
  SpeciesEditor: undefined;
};
type LocalRoute = RouteProp<LocalStackParamList, 'PetsAdd'>;

// ---- date helpers ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISODate = (s: string): Date | null => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return new Date(y, mo - 1, d);
};

// 允許值
const HABITATS: Habitat[] = ['indoor_uvb', 'outdoor_sun', 'mixed'];

export default function PetsAddScreen() {
  const route = useRoute<LocalRoute>();
  const navigation = useNavigation<NavigationProp<LocalStackParamList>>();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();

  // 與 HomeScreen 對齊的 palette
  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? colors.textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? '#38e07b',
    }),
    [colors]
  );

  // 其他 UI 用色
  const ui = useMemo(
    () => ({
      hairline: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      placeholder: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
      inputBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      chipBorder: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
      overlay: 'rgba(0,0,0,0.45)',
      inverseBg: palette.text,
      inverseText: palette.bg,
    }),
    [isDark, palette.bg, palette.text]
  );

  const editingId = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [species, setSpecies] = useState<SpeciesRow[]>([]);

  // 表單狀態
  const [name, setName] = useState('');
  const [speciesKey, setSpeciesKey] = useState('');
  const [habitat, setHabitat] = useState<Habitat>('indoor_uvb');

  const [birthDateIso, setBirthDateIso] = useState<string>(''); // '' => 未設定
  const [birthDateObj, setBirthDateObj] = useState<Date | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(new Date());

  const [locationCity, setLocationCity] = useState<string>('');
  const [avatarUri, setAvatarUri] = useState<string>('');

  // refs
  const locationRef = useRef<RNTextInput>(null);

  const { pickFromLibrary, takePhoto } = useImagePicker();

  const title = editingId ? 'Edit Pet' : 'Add Pet';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sp] = await Promise.all([listSpecies()]);
      setSpecies(sp);

      if (editingId) {
        const row = await getPetById(editingId);
        if (!row) {
          Alert.alert('Not found', 'The pet no longer exists.');
          navigation.goBack();
          return;
        }
        setName(row.name);
        setSpeciesKey(row.species_key);
        setHabitat(row.habitat);

        const parsed = row.birth_date ? parseISODate(row.birth_date) : null;
        setBirthDateIso(row.birth_date ?? '');
        setBirthDateObj(parsed);
        setIosTempDate(parsed ?? new Date());

        setLocationCity(row.location_city ?? '');
        setAvatarUri(row.avatar_uri ?? '');
      } else if (sp.length > 0 && !speciesKey) {
        setSpeciesKey(sp[0].key);
      }
    } catch (err: any) {
      Alert.alert('Load failed', err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [editingId, navigation, speciesKey]);

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
    load();
  }, [load, navigation]);

  // 回到此畫面時刷新 species 清單
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const sp = await listSpecies();
          if (alive) setSpecies(sp);
        } catch {}
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const speciesOptions = useMemo(
    () => species.map((s) => ({ label: s.common_name, value: s.key })),
    [species]
  );

  const habitatOptions = useMemo(
    () =>
      HABITATS.map((h) => ({
        label: h === 'indoor_uvb' ? 'Indoor (UVB)' : h === 'outdoor_sun' ? 'Outdoor (Sun)' : 'Mixed',
        value: h,
      })),
    []
  );

  // 選擇頭像
  const chooseAvatar = useCallback(() => {
    Alert.alert('選擇頭像', '要從哪裡選取？', [
      {
        text: '相簿',
        onPress: async () => {
          const uri = await pickFromLibrary();
          if (uri) setAvatarUri(uri);
        },
      },
      {
        text: '相機',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) setAvatarUri(uri);
        },
      },
      { text: '取消', style: 'cancel' },
    ]);
  }, [pickFromLibrary, takePhoto]);

  // Birth date handlers
  const openDatePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      setShowDatePicker(true);
    } else {
      setIosTempDate(birthDateObj ?? new Date());
      setShowDatePicker(true);
    }
  }, [birthDateObj]);

  const onAndroidDateChange = useCallback(
    (_e: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (date) {
        setBirthDateObj(date);
        setBirthDateIso(toISODate(date));
      }
    },
    []
  );

  const onIosConfirm = useCallback(() => {
    setBirthDateObj(iosTempDate);
    setBirthDateIso(toISODate(iosTempDate));
    setShowDatePicker(false);
    locationRef.current?.focus();
  }, [iosTempDate]);

  const onIosCancel = useCallback(() => setShowDatePicker(false), []);
  const clearBirthDate = useCallback(() => {
    setBirthDateIso('');
    setBirthDateObj(null);
  }, []);
  const goToSpeciesEditor = useCallback(() => navigation.navigate('SpeciesEditor'), [navigation]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter pet name.');
      return;
    }
    if (!speciesKey) {
      Alert.alert('Validation', 'Please select species.');
      return;
    }
    if (birthDateIso && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) {
      Alert.alert('Validation', 'Birth date must be YYYY-MM-DD or empty.');
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        const patch: PetUpdate = {
          name: name.trim(),
          species_key: speciesKey,
          habitat,
          birth_date: birthDateIso || null,
          location_city: locationCity.trim() || null,
          avatar_uri: avatarUri || null,
        };
        await updatePet(editingId, patch);
      } else {
        const input: PetInsert = {
          name: name.trim(),
          species_key: speciesKey,
          habitat,
          birth_date: birthDateIso || null,
          location_city: locationCity.trim() || null,
          avatar_uri: avatarUri || null,
        };
        await insertPet(input);
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }, [avatarUri, birthDateIso, habitat, locationCity, name, navigation, speciesKey, editingId]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.loading, { backgroundColor: palette.bg }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: ui.hairline }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.closeButton, { color: palette.text }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Body */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={[styles.body, { gap: 14 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar（右下角覆蓋＋按鈕） */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarCircle, { backgroundColor: ui.inputBg }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={{ color: palette.subText, fontSize: 28 }}>🦎</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={chooseAvatar}
              style={[
                styles.avatarAdd,
                { backgroundColor: palette.primary, borderColor: palette.bg },
              ]}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Text style={[styles.avatarAddText, { color: palette.bg }]}>＋</Text>
            </TouchableOpacity>
          </View>

          {/* Pet Name */}
          <Field label="Pet Name">
            <TextInput
              placeholder="e.g. Spike"
              placeholderTextColor={ui.placeholder}
              value={name}
              onChangeText={setName}
              style={[styles.input, { backgroundColor: ui.inputBg, color: palette.text }]}
              autoCapitalize="words"
              autoCorrect
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={openDatePicker}
            />
          </Field>

          {/* Species + Add Species */}
          <Field label="Species">
            <View style={[styles.select, { backgroundColor: ui.inputBg }]}>
              <View style={styles.speciesRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingRight: 8 }}
                >
                  {speciesOptions.map((opt) => {
                    const selected = opt.value === speciesKey;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setSpeciesKey(opt.value)}
                        style={[
                          styles.chip,
                          { borderColor: ui.chipBorder },
                          selected && { backgroundColor: ui.inverseBg, borderColor: ui.inverseBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: palette.text },
                            selected && { color: ui.inverseText, fontWeight: '600' },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => navigation.navigate('SpeciesEditor')}
                  style={[styles.addSpeciesBtn, { backgroundColor: ui.inverseBg }]}
                >
                  <Text style={[styles.addSpeciesBtnText, { color: ui.inverseText }]}>
                    ＋ Add Species
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Field>

          {/* Habitat */}
          <Field label="Habitat">
            <View style={[styles.select, { backgroundColor: ui.inputBg }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {habitatOptions.map((opt) => {
                  const selected = opt.value === habitat;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setHabitat(opt.value as Habitat)}
                      style={[
                        styles.chip,
                        { borderColor: ui.chipBorder },
                        selected && { backgroundColor: ui.inverseBg, borderColor: ui.inverseBg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: palette.text },
                          selected && { color: ui.inverseText, fontWeight: '600' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Field>

          {/* Birth Date */}
          <Field label="Birth Date (YYYY-MM-DD)">
            <View style={styles.dateRow}>
              <Pressable
                onPress={openDatePicker}
                style={[styles.dateInputLike, { backgroundColor: ui.inputBg }]}
              >
                <Text style={birthDateIso ? { color: palette.text } : { color: ui.placeholder }}>
                  {birthDateIso || 'Select a date'}
                </Text>
              </Pressable>
              {!!birthDateIso && (
                <TouchableOpacity
                  onPress={clearBirthDate}
                  style={[styles.clearBtn, { backgroundColor: ui.inputBg }]}
                >
                  <Text style={{ color: palette.text, fontSize: 12 }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </Field>

          {/* Location (City) */}
          <Field label="Location (City)">
            <TextInput
              ref={locationRef}
              placeholder="e.g. Taipei"
              placeholderTextColor={ui.placeholder}
              value={locationCity}
              onChangeText={setLocationCity}
              style={[styles.input, { backgroundColor: ui.inputBg, color: palette.text }]}
              autoCapitalize="words"
              autoCorrect
              autoComplete="postal-address-locality"
              textContentType="addressCity"
              returnKeyType="done"
            />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer（含底部安全區域） */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: ui.hairline,
            backgroundColor: palette.bg,
            paddingBottom: 16 + insets.bottom,
          },
        ]}
      >
        <PrimaryButton
          title={editingId ? 'Save Changes' : 'Add Pet'}
          onPress={onSave}
          disabled={saving}
          style={{ borderRadius: 16 }}
        />
      </View>

      {/* ---- Android inline modal ---- */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={birthDateObj ?? new Date()}
          mode="date"
          display="default"
          onChange={onAndroidDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* ---- iOS overlay with spinner ---- */}
      {Platform.OS === 'ios' && showDatePicker && (
        <View style={[styles.iosOverlay, { backgroundColor: ui.overlay }]}>
          <View style={[styles.iosSheet, { backgroundColor: palette.card }]}>
            <View style={[styles.iosSheetHeader, { borderBottomColor: ui.hairline }]}>
              <TouchableOpacity onPress={onIosCancel} style={styles.iosHeaderBtn}>
                <Text style={[styles.iosHeaderBtnText, { color: palette.text }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.iosHeaderTitle, { color: palette.text }]}>Select Date</Text>
              <TouchableOpacity onPress={onIosConfirm} style={styles.iosHeaderBtn}>
                <Text style={[styles.iosHeaderBtnText, { color: palette.text, fontWeight: '700' }]}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={iosTempDate}
              onChange={(_, d) => d && setIosTempDate(d)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  closeButton: { fontSize: 20, width: 24, textAlign: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', paddingRight: 24,
  },
  body: { padding: 16 },

  // Avatar + 「＋」浮動按鈕
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',      // 讓右下角按鈕以此定位
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarAdd: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarAddText: { fontWeight: 'bold', fontSize: 18, lineHeight: 18 },

  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },

  // species row
  speciesRow: { flexDirection: 'row', alignItems: 'center' },
  addSpeciesBtn: { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  addSpeciesBtnText: { fontWeight: '600', fontSize: 12 },

  select: { borderRadius: 12, padding: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, backgroundColor: 'transparent',
    borderWidth: 1, marginRight: 8,
  },
  chipText: {},

  // date field styles
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInputLike: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },

  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },

  // iOS overlay
  iosOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' },
  iosSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24 },
  iosSheetHeader: {
    height: 48, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosHeaderBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  iosHeaderBtnText: {},
  iosHeaderTitle: { fontWeight: '600' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
