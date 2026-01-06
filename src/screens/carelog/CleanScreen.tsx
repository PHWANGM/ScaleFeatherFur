// src/screens/CleanScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { insertCareLog } from '../../lib/db/repos/care.logs';
import { selectCurrentPetId } from '../../state/slices/petsSlice';
import { useAppSelector } from '../../state/hooks';
import { useThemeColors } from '../../styles/themesColors';
import type { RootStackParamList } from '../../navigation/rootNavigator';

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const combineDateTime = (datePart: Date, timePart: Date) =>
  new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes(),
    0,
    0
  );

const CleanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const currentPetId = useAppSelector(selectCurrentPetId);
  const { colors } = useThemeColors();

  const now = useMemo(() => new Date(), []);
  const [datePart, setDatePart] = useState<Date>(now);
  const [timePart, setTimePart] = useState<Date>(now);
  const [saving, setSaving] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [iosPickerMode, setIosPickerMode] = useState<'date' | 'time' | null>(null);
  const [iosTemp, setIosTemp] = useState<Date>(now);

  const openDatePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      setShowDatePicker(true);
    } else {
      setIosTemp(datePart);
      setIosPickerMode('date');
    }
  }, [datePart]);

  const openTimePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      setShowTimePicker(true);
    } else {
      setIosTemp(timePart);
      setIosPickerMode('time');
    }
  }, [timePart]);

  const onAndroidDateChange = useCallback(
    (_e: DateTimePickerEvent, date?: Date) => {
      setShowDatePicker(false);
      if (date) setDatePart(date);
    },
    []
  );

  const onAndroidTimeChange = useCallback(
    (_e: DateTimePickerEvent, date?: Date) => {
      setShowTimePicker(false);
      if (date) setTimePart(date);
    },
    []
  );

  const onIosCancel = useCallback(() => setIosPickerMode(null), []);
  const onIosConfirm = useCallback(() => {
    if (iosPickerMode === 'date') setDatePart(iosTemp);
    if (iosPickerMode === 'time') setTimePart(iosTemp);
    setIosPickerMode(null);
  }, [iosPickerMode, iosTemp]);

  const handleClean = useCallback(async () => {
    if (!currentPetId) {
      Alert.alert('Select a pet first', 'Please choose a pet before logging clean.');
      return;
    }
    const at = combineDateTime(datePart, timePart);
    try {
      setSaving(true);
      await insertCareLog({
        pet_id: currentPetId,
        type: 'clean',
        subtype: null,
        category: 'maint',
        value: null,
        unit: null,
        note: 'Cleaned enclosure',
        at: at.toISOString(),
      });
      navigation.navigate('MainTabs', { screen: 'Care' });
    } catch (err) {
      console.error('[CleanScreen] Failed to save clean log:', err);
      Alert.alert('Save failed', 'Failed to save clean log. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentPetId, datePart, navigation, timePart]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>Date</Text>
          <Pressable
            style={[styles.inputLike, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openDatePicker}
          >
            <Text style={[styles.valueText, { color: colors.text }]}>{formatDate(datePart)}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.subText }]}>Time</Text>
          <Pressable
            style={[styles.inputLike, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openTimePicker}
          >
            <Text style={[styles.valueText, { color: colors.text }]}>{formatTime(timePart)}</Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 },
          ]}
          onPress={handleClean}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>執行清潔</Text>
        </Pressable>
      </View>

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={datePart}
          mode="date"
          display="default"
          onChange={onAndroidDateChange}
        />
      )}

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={timePart}
          mode="time"
          display="default"
          onChange={onAndroidTimeChange}
        />
      )}

      {Platform.OS === 'ios' && iosPickerMode && (
        <View style={styles.iosOverlay}>
          <View style={[styles.iosSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iosHeader, { borderBottomColor: colors.border }]}>
              <Pressable onPress={onIosCancel} style={styles.iosHeaderBtn}>
                <Text style={[styles.iosHeaderBtnText, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.iosHeaderTitle, { color: colors.text }]}>
                {iosPickerMode === 'date' ? 'Select Date' : 'Select Time'}
              </Text>
              <Pressable onPress={onIosConfirm} style={styles.iosHeaderBtn}>
                <Text style={[styles.iosHeaderBtnText, { color: colors.text, fontWeight: '700' }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosTemp}
              onChange={(_, d) => d && setIosTemp(d)}
              mode={iosPickerMode}
              display="spinner"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 16, gap: 16 },
  section: { gap: 8 },
  label: { fontSize: 13 },
  inputLike: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  valueText: { fontSize: 16 },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#022c22', fontSize: 16, fontWeight: '700' },
  iosOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iosSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iosHeader: {
    height: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosHeaderBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  iosHeaderBtnText: { fontSize: 14 },
  iosHeaderTitle: { fontSize: 15, fontWeight: '600' },
});

export default CleanScreen;
