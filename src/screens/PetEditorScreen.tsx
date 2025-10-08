// src/screens/PetEditorScreen.tsx
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

type RootStackParamList = {
  PetEditor: { id?: string } | undefined;
  SpeciesEditor: undefined; // 供 navigate 使用
};

type PetEditorRoute = RouteProp<RootStackParamList, 'PetEditor'>;

const HABITATS: Habitat[] = ['indoor_uvb', 'outdoor_sun', 'mixed'];

// ---- date helpers ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISODate = (s: string): Date | null => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return new Date(y, mo - 1, d);
};

export default function PetEditorScreen() {
  const route = useRoute<PetEditorRoute>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const editingId = route.params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [species, setSpecies] = useState<SpeciesRow[]>([]);

  // form state
  const [name, setName] = useState('');
  const [speciesKey, setSpeciesKey] = useState('');
  const [habitat, setHabitat] = useState<Habitat>('indoor_uvb');

  // Birth date managed by ISO string + Date object
  const [birthDateIso, setBirthDateIso] = useState<string>('');     // '' => 未設定
  const [birthDateObj, setBirthDateObj] = useState<Date | null>(null);

  // iOS picker overlay
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(new Date());

  const [locationCity, setLocationCity] = useState<string>('');
  const [avatarUri, setAvatarUri] = useState<string>('');

  // refs for "next" focus
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

  // 回到此畫面時刷新 species 清單（例如剛從 SpeciesEditor 新增後）
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

  // Avatar 選擇
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

  const onIosCancel = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const clearBirthDate = useCallback(() => {
    setBirthDateIso('');
    setBirthDateObj(null);
  }, []);

  const goToSpeciesEditor = useCallback(() => {
    navigation.navigate('SpeciesEditor');
  }, [navigation]);

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
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Body */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={{ opacity: 0.6 }}>🦎</Text>
              )}
            </View>

            <TouchableOpacity onPress={chooseAvatar} style={styles.avatarAdd}>
              <Text style={styles.avatarAddText}>＋</Text>
            </TouchableOpacity>
          </View>

          {/* Pet Name */}
          <Field label="Pet Name">
            <TextInput
              placeholder="e.g. Spike"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={name}
              onChangeText={setName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={true}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={openDatePicker} // 直接開日期選擇器
            />
          </Field>

          {/* Species + Add Species */}
          <Field label="Species">
            <View style={[styles.select, styles.speciesSelectWrap]}>
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
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity onPress={goToSpeciesEditor} style={styles.addSpeciesBtn}>
                  <Text style={styles.addSpeciesBtnText}>＋ Add Species</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Field>

          {/* Habitat */}
          <Field label="Habitat">
            <View style={styles.select}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {habitatOptions.map((opt) => {
                  const selected = opt.value === habitat;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setHabitat(opt.value as Habitat)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Field>

          {/* Birth Date：日期選擇器 */}
          <Field label="Birth Date (YYYY-MM-DD)">
            <View style={styles.dateRow}>
              <Pressable onPress={openDatePicker} style={styles.dateInputLike}>
                <Text style={birthDateIso ? styles.dateText : styles.datePlaceholder}>
                  {birthDateIso || 'Select a date'}
                </Text>
              </Pressable>
              {!!birthDateIso && (
                <TouchableOpacity onPress={clearBirthDate} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </Field>

          {/* Location (City) */}
          <Field label="Location (City)">
            <TextInput
              ref={locationRef}
              placeholder="e.g. Taipei"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={locationCity}
              onChangeText={setLocationCity}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={true}
              autoComplete="postal-address-locality"
              textContentType="addressCity"
              returnKeyType="done"
            />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          disabled={saving}
          onPress={onSave}
          style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryBtnText}>{editingId ? 'Save Changes' : 'Add Pet'}</Text>
        </TouchableOpacity>
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
        <View style={styles.iosOverlay}>
          <View style={styles.iosSheet}>
            <View style={styles.iosSheetHeader}>
              <TouchableOpacity onPress={onIosCancel} style={styles.iosHeaderBtn}>
                <Text style={styles.iosHeaderBtnText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.iosHeaderTitle}>Select Date</Text>
              <TouchableOpacity onPress={onIosConfirm} style={styles.iosHeaderBtn}>
                <Text style={[styles.iosHeaderBtnText, { fontWeight: '700' }]}>Done</Text>
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
    </View>
  );
}

const BG_DARK = '#122017';
const PRIMARY = '#38e07b';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DARK },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  closeButton: { color: 'white', fontSize: 20, width: 24, textAlign: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    paddingRight: 24,
  },
  body: { padding: 16, gap: 14 },
  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarAdd: {
    position: 'absolute',
    right: (StyleSheet.hairlineWidth + 96) / 6,
    bottom: (StyleSheet.hairlineWidth + 96) / 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: BG_DARK,
    borderWidth: 2,
  },
  avatarAddText: { color: BG_DARK, fontWeight: 'bold', fontSize: 18, lineHeight: 18 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: 'white',
  },

  // species row
  speciesSelectWrap: { paddingRight: 8 },
  speciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addSpeciesBtn: {
    marginLeft: 8,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addSpeciesBtnText: { color: BG_DARK, fontWeight: '600', fontSize: 12 },

  select: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginRight: 8,
  },
  chipSelected: { backgroundColor: 'white' },
  chipText: { color: 'rgba(255,255,255,0.8)' },
  chipTextSelected: { color: BG_DARK, fontWeight: '600' },

  // date field styles
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInputLike: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateText: { color: 'white' },
  datePlaceholder: { color: 'rgba(255,255,255,0.5)' },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  clearBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },

  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: BG_DARK,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: BG_DARK, fontWeight: 'bold', fontSize: 16 },

  // iOS overlay
  iosOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  iosSheet: {
    backgroundColor: BG_DARK,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosSheetHeader: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosHeaderBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  iosHeaderBtnText: { color: 'white' },
  iosHeaderTitle: { color: 'white', fontWeight: '600' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_DARK },
});
