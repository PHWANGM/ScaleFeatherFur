// src/screens/UVBLogScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';

import { insertCareLog } from '../lib/db/repos/care.logs';
import { selectCurrentPetId, selectSelectedDate } from '../state/slices/petsSlice';
import { endSession, selectUvbSessionByPetId, startSession } from '../state/slices/uvbSlice';
import { useThemeColors } from '../styles/themesColors';
import { useAppSelector } from '../state/hooks';

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

const UVBLogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const currentPetId = useAppSelector(selectCurrentPetId);
  const selectedDate = useAppSelector(selectSelectedDate);
  const uvbSession = useAppSelector((state) => selectUvbSessionByPetId(state, currentPetId));
  const { colors } = useThemeColors();

  const initialDate = useMemo(() => {
    if (!selectedDate) return new Date();
    const d = new Date(selectedDate);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [selectedDate]);

  const [datePart, setDatePart] = useState<Date>(initialDate);
  const [timePart, setTimePart] = useState<Date>(new Date());
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saving, setSaving] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [iosPickerMode, setIosPickerMode] = useState<'date' | 'time' | null>(null);
  const [iosTemp, setIosTemp] = useState<Date>(new Date());

  const sessionStarted = uvbSession.active;
  const sessionStartAt = useMemo(
    () => (uvbSession.startAtIso ? new Date(uvbSession.startAtIso) : null),
    [uvbSession.startAtIso]
  );
  const timerStartMs = uvbSession.timerStartMs;

  const effectiveDurationMinutes = sessionStarted
    ? uvbSession.durationMinutes
    : Number(durationMinutes);

  const durationMs = useMemo(() => {
    const n = effectiveDurationMinutes;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) * 60_000 : 0;
  }, [effectiveDurationMinutes]);

  const remainingMs = useMemo(() => {
    if (durationMs <= 0) return 0;
    return Math.max(durationMs - elapsedMs, 0);
  }, [durationMs, elapsedMs]);

  useEffect(() => {
    if (!sessionStarted || timerStartMs == null) return;
    setElapsedMs(Math.max(Date.now() - timerStartMs, 0));
    const id = setInterval(() => {
      const next = Date.now() - timerStartMs;
      setElapsedMs(next);
    }, 500);
    return () => clearInterval(id);
  }, [sessionStarted, timerStartMs, durationMs]);

  useEffect(() => {
    if (!sessionStarted || !sessionStartAt) return;
    setDatePart(sessionStartAt);
    setTimePart(sessionStartAt);
    setDurationMinutes(String(uvbSession.durationMinutes));
  }, [sessionStarted, sessionStartAt, uvbSession.durationMinutes]);

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

  const handleStart = useCallback(() => {
    if (!currentPetId) {
      Alert.alert('Select a pet first', 'Please choose a pet before logging UVB.');
      return;
    }
    const minutesValue = Number(durationMinutes);
    if (!Number.isFinite(minutesValue) || minutesValue <= 0) {
      Alert.alert('Invalid timer', 'Please set a positive duration in minutes.');
      return;
    }
    const startAt = combineDateTime(datePart, timePart);
    dispatch(
      startSession({
        petId: currentPetId,
        startAtIso: startAt.toISOString(),
        timerStartMs: Date.now(),
        durationMinutes: Math.floor(minutesValue),
      })
    );
    setElapsedMs(0);
  }, [currentPetId, datePart, dispatch, durationMinutes, timePart]);

  const handleStop = useCallback(async () => {
    if (!currentPetId || !sessionStarted || !sessionStartAt) return;
    const effectiveElapsedMs =
      timerStartMs != null ? Math.max(Date.now() - timerStartMs, 0) : Math.max(elapsedMs, 0);
    const endAt = new Date(sessionStartAt.getTime() + effectiveElapsedMs);
    const durationMin = Math.max(1, Math.round(effectiveElapsedMs / 60000));

    try {
      setSaving(true);
      await insertCareLog({
        pet_id: currentPetId,
        type: 'uvb_on',
        subtype: 'uvb',
        category: 'light',
        value: null,
        unit: null,
        note: null,
        at: sessionStartAt.toISOString(),
      });
      await insertCareLog({
        pet_id: currentPetId,
        type: 'uvb_off',
        subtype: 'uvb',
        category: 'light',
        value: durationMin,
        unit: 'min',
        note: null,
        at: endAt.toISOString(),
      });

      dispatch(endSession({ petId: currentPetId }));
      setElapsedMs(0);

      navigation.navigate('MainTabs', { screen: 'Care' });
    } catch (err) {
      console.error('[UVBLogScreen] Failed to save UVB logs:', err);
      Alert.alert('Save failed', 'Failed to save UVB logs. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [currentPetId, dispatch, elapsedMs, navigation, sessionStartAt, sessionStarted, timerStartMs]);

  const elapsedDisplay = useMemo(() => {
    const totalSec = Math.floor(elapsedMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }, [elapsedMs]);

  const remainingDisplay = useMemo(() => {
    if (durationMs <= 0) return '--:--';
    const totalSec = Math.floor(remainingMs / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${pad2(mm)}:${pad2(ss)}`;
  }, [durationMs, remainingMs]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.subText }]}>Date</Text>
        <Pressable
          style={[styles.inputLike, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openDatePicker}
          disabled={sessionStarted}
        >
          <Text style={[styles.valueText, { color: colors.text }]}>{formatDate(datePart)}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.subText }]}>Time</Text>
        <Pressable
          style={[styles.inputLike, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openTimePicker}
          disabled={sessionStarted}
        >
          <Text style={[styles.valueText, { color: colors.text }]}>{formatTime(timePart)}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.subText }]}>Timer (minutes)</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
          ]}
          value={durationMinutes}
          onChangeText={setDurationMinutes}
          inputMode="numeric"
          keyboardType="number-pad"
          placeholder="30"
          placeholderTextColor={colors.subText}
          editable={!sessionStarted}
        />
      </View>

      <View style={styles.timerCard}>
        <View style={styles.timerRow}>
          <Text style={[styles.timerLabel, { color: colors.subText }]}>Elapsed</Text>
          <Text style={[styles.timerValue, { color: colors.text }]}>{elapsedDisplay}</Text>
        </View>
        <View style={styles.timerRow}>
          <Text style={[styles.timerLabel, { color: colors.subText }]}>Remaining</Text>
          <Text style={[styles.timerValue, { color: colors.text }]}>{remainingDisplay}</Text>
        </View>
        {!!sessionStarted && durationMs > 0 && (
          <Text
            style={[
              styles.timerStatus,
              { color: elapsedMs >= durationMs ? '#ef4444' : colors.subText },
            ]}
          >
            {elapsedMs >= durationMs ? 'Over exposure time!' : 'Counting down'}
          </Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, opacity: sessionStarted || saving ? 0.6 : 1 },
          ]}
          onPress={handleStart}
          disabled={sessionStarted || saving}
        >
          <Text style={styles.primaryButtonText}>Start Exposure</Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondaryButton,
            { borderColor: colors.border, opacity: !sessionStarted || saving ? 0.6 : 1 },
          ]}
          onPress={handleStop}
          disabled={!sessionStarted || saving}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>End Exposure</Text>
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
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  timerCard: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  timerLabel: { fontSize: 13 },
  timerValue: { fontSize: 18, fontWeight: '700' },
  timerStatus: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  buttonRow: { gap: 12, marginTop: 8 },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#022c22', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
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

export default UVBLogScreen;
