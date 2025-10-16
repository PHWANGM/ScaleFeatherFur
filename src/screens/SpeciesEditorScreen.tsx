// src/screens/SpeciesEditorScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import {
  getSpeciesByKey,
  insertSpecies,
  updateSpecies,
  deleteSpecies,
  type SpeciesRow,
} from '../lib/db/repos/species.repo';
import Field from '../components/fields/Field';

type RootStackParamList = {
  SpeciesEditor: { key?: string } | undefined;
};

type SpeciesEditorRoute = RouteProp<RootStackParamList, 'SpeciesEditor'>;

const BG_DARK = '#122017';
const PRIMARY = '#38e07b';

function slugifyCommonName(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')          // 空白或斜線 -> '-'
    .replace(/[^a-z0-9\-_]/g, '')     // 只留 a-z0-9_- 
    .replace(/-+/g, '-')              // 多個 '-' 合併
    .replace(/^[-_]+|[-_]+$/g, '');   // 修剪頭尾 -_
}

export default function SpeciesEditorScreen() {
  const route = useRoute<SpeciesEditorRoute>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const editingKeyParam = route.params?.key;
  const isEditing = !!editingKeyParam;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [keyValue, setKeyValue] = useState('');
  const [commonName, setCommonName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [notes, setNotes] = useState('');

  const [keyTouched, setKeyTouched] = useState(false); // 只要使用者改過 key，就不再自動生成

  // refs for Next 跳焦點
  const refKey = useRef<RNTextInput>(null);
  const refCommon = useRef<RNTextInput>(null);
  const refScientific = useRef<RNTextInput>(null);
  const refNotes = useRef<RNTextInput>(null);

  const title = isEditing ? 'Edit Species' : 'Add Species';

  // 載入資料（編輯模式）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        if (isEditing && editingKeyParam) {
          const row = await getSpeciesByKey(editingKeyParam);
          if (!row) {
            Alert.alert('Not found', `Species ${editingKeyParam} not found.`);
            navigation.goBack();
            return;
          }
          if (!alive) return;
          setKeyValue(row.key);
          setCommonName(row.common_name);
          setScientificName(row.scientific_name ?? '');
          setNotes(row.notes ?? '');
          setKeyTouched(true); // 編輯模式不要自動覆蓋 key
        } else {
          // 新增模式：預設焦點在 Common Name
          setTimeout(() => refCommon.current?.focus(), 0);
        }
      } catch (err: any) {
        Alert.alert('Load failed', err?.message ?? String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEditing, editingKeyParam, navigation]);

  // 使用者輸入 common name 時，若尚未手動改過 key，就自動生成
  useEffect(() => {
    if (!keyTouched && !isEditing) {
      const slug = slugifyCommonName(commonName);
      setKeyValue(slug);
    }
  }, [commonName, keyTouched, isEditing]);

  const validate = useCallback(async (): Promise<boolean> => {
    // key 必填，格式檢核
    if (!keyValue.trim()) {
      Alert.alert('Validation', 'Please enter a species key.');
      refKey.current?.focus();
      return false;
    }
    if (!/^[a-z0-9\-_]+$/.test(keyValue)) {
      Alert.alert('Validation', 'Key can only contain lowercase letters, numbers, "-" and "_".');
      refKey.current?.focus();
      return false;
    }
    // common name 必填
    if (!commonName.trim()) {
      Alert.alert('Validation', 'Please enter a common name.');
      refCommon.current?.focus();
      return false;
    }
    // 新增時檢查重複 key
    if (!isEditing || keyValue !== editingKeyParam) {
      const dup = await getSpeciesByKey(keyValue);
      if (dup) {
        Alert.alert('Validation', `Key "${keyValue}" already exists.`);
        refKey.current?.focus();
        return false;
      }
    }
    return true;
  }, [keyValue, commonName, isEditing, editingKeyParam]);

  const onSave = useCallback(async () => {
    if (!(await validate())) return;

    try {
      setSaving(true);
      if (isEditing && editingKeyParam) {
        // 若允許改 key，會很複雜（涉及外鍵）；這裡鎖定 key 不可改
        await updateSpecies(editingKeyParam, {
          common_name: commonName.trim(),
          scientific_name: scientificName.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await insertSpecies({
          key: keyValue.trim(),
          common_name: commonName.trim(),
          scientific_name: scientificName.trim() || null,
          notes: notes.trim() || null,
        });
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }, [validate, isEditing, editingKeyParam, keyValue, commonName, scientificName, notes, navigation]);

  const onDelete = useCallback(() => {
    if (!isEditing || !editingKeyParam) return;
    Alert.alert(
      'Delete species',
      `Are you sure you want to delete "${commonName || editingKeyParam}"?\n\nRelated pets referencing this key will fail FK checks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const ok = await deleteSpecies(editingKeyParam);
              if (!ok) {
                Alert.alert('Delete failed', 'The species could not be deleted.');
                return;
              }
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Delete failed', err?.message ?? String(err));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [isEditing, editingKeyParam, commonName, navigation]);

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
          {/* Key（編輯模式禁改，避免破壞 FK） */}
          <Field label="Key (unique, lowercase, a-z 0-9 - _)">
            <TextInput
              ref={refKey}
              placeholder="e.g. leopard_gecko"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={keyValue}
              onChangeText={(t) => {
                setKeyTouched(true);
                setKeyValue(t.toLowerCase());
              }}
              editable={!isEditing}
              style={[styles.input, isEditing && styles.inputDisabled]}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refCommon.current?.focus()}
            />
          </Field>

          {/* Common name */}
          <Field label="Common Name">
            <TextInput
              ref={refCommon}
              placeholder="e.g. Leopard Gecko"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={commonName}
              onChangeText={setCommonName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={true}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refScientific.current?.focus()}
            />
          </Field>

          {/* Scientific name（可空） */}
          <Field label="Scientific Name (optional)">
            <TextInput
              ref={refScientific}
              placeholder="e.g. Eublepharis macularius"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={scientificName}
              onChangeText={setScientificName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={true}
              autoComplete="off"
              textContentType="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refNotes.current?.focus()}
            />
          </Field>

          {/* Notes（多行，可空） */}
          <Field label="Notes (optional)">
            <TextInput
              ref={refNotes}
              placeholder="Any notes…"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.notes]}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footerRow}>
        {isEditing ? (
          <TouchableOpacity disabled={saving} onPress={onDelete} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>Delete</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity disabled={saving} onPress={onSave} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
    flex: 1, textAlign: 'center', color: 'white', fontSize: 18, fontWeight: 'bold', paddingRight: 24,
  },

  body: { padding: 16, gap: 14 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: 'white',
  },
  inputDisabled: { opacity: 0.6 },

  notes: { minHeight: 120 },

  footerRow: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: BG_DARK,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryBtnText: { color: BG_DARK, fontWeight: 'bold', fontSize: 16 },

  dangerBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 99, 71, 0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 99, 71, 0.4)',
  },
  dangerBtnText: { color: 'tomato', fontWeight: 'bold' },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_DARK },
});
