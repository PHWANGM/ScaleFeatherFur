// src/components/CustomCalendar.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import {
  setSelectedDate,
  setCurrentPetId,
  selectCurrentPetId,
  selectSelectedDate,
} from '../../state/slices/petsSlice';
import { nowIso } from '../../lib/db/repos/_helpers';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
  type CareLogType,
} from '../../lib/db/repos/care.logs';
import { query } from '../../lib/db/db.client'; // ✅ 用來做診斷查詢

// ==== 型別 ====
type CalDateObject = {
  dateString: string;
  day: number;
  month: number;
  year: number;
  timestamp: number;
};
type DotMark = { color: string; key?: string };
type MultiDotMark = { dots?: DotMark[]; selected?: boolean };
type MarkedDatesMap = Record<string, MultiDotMark>;
type VisibleMonth = { year: number; month: number };

// ==== Locale ====
LocaleConfig.locales.en = {
  monthNames: [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ],
  monthNamesShort: ['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};
LocaleConfig.defaultLocale = 'en';

// ==== 顏色對應（完整列出 CareLogType）====
const DOTS: Record<CareLogType, { color: string }> = {
  feed:     { color: '#FC3090' },
  calcium:  { color: '#8D8DAA' },
  vitamin:  { color: '#52B788' },
  uvb_on:   { color: '#2871C8' },
  uvb_off:  { color: '#1DA8B1' },
  heat_on:  { color: '#FF7043' },
  heat_off: { color: '#8D6E63' },
  clean:    { color: '#9B51E0' },
  weigh:    { color: '#FFA500' },
};

// ==== 小工具 ====
// 用「UTC 明日 00:00」往回 6 個月；若你要用本地日界，請改成下方 buildQueryWindowLocal。
const buildQueryWindow = () => {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 6);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

// （可選）本地日界版本，若你懷疑 UTC 導致 off-by-one，可以改用這個。
// const buildQueryWindowLocal = () => {
//   const endLocal = new Date();
//   endLocal.setHours(24, 0, 0, 0); // 明日本地 00:00
//   const startLocal = new Date(endLocal);
//   startLocal.setMonth(startLocal.getMonth() - 6);
//   return { startISO: startLocal.toISOString(), endISO: endLocal.toISOString() };
// };

const ensureISODateTime = (isoLike: string) =>
  isoLike.includes('T') ? isoLike : `${isoLike}T${new Date().toISOString().split('T')[1]}`;

function ensureDay(map: MarkedDatesMap, day: string): MultiDotMark {
  if (!map[day]) map[day] = { selected: false, dots: [] };
  else if (!map[day].dots) map[day].dots = [];
  return map[day];
}

function buildMarkedDates(
  rows: CareLogRow[],
  todayISO: string,
  selectedISO?: string | null
): MarkedDatesMap {
  const selectedDay = selectedISO ? selectedISO.slice(0, 10) : todayISO;
  const map: MarkedDatesMap = {};

  ensureDay(map, selectedDay).selected = true;

  for (const log of rows) {
    const day = log.at.slice(0, 10);
    const color = DOTS[log.type]?.color;
    if (!color) continue;
    const entry = ensureDay(map, day);
    entry.selected = day === selectedDay;
    const key = `${log.type}:${color}`;
    const exists = (entry.dots ?? []).some(
      (d) => (d.key ?? '') === key && d.color === color
    );
    if (!exists) entry.dots!.push({ color, key });
  }

  if (!map[todayISO]) {
    const e = ensureDay(map, todayISO);
    e.selected = todayISO === selectedDay;
  }

  return map;
}

const CustomCalendar: React.FC = () => {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const currentPetId = useSelector(selectCurrentPetId) as string | null;
  const selectedDate = useSelector(selectSelectedDate) as string | null;

  const [marked, setMarked] = useState<MarkedDatesMap>({});
  const [loading, setLoading] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<VisibleMonth | null>(null);

  const effectiveSelectedISO = useMemo(() => selectedDate ?? nowIso(), [selectedDate]);

  // ===== Debug logs =====
  useEffect(() => {
    console.log('[CustomCalendar] selectedDate (from store) =', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    console.log('[CustomCalendar] currentPetId =', currentPetId);
  }, [currentPetId]);

  // 初始化 visibleMonth
  useEffect(() => {
    const d = new Date(effectiveSelectedISO);
    if (!Number.isNaN(d.getTime())) {
      setVisibleMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }
  }, [effectiveSelectedISO]);

  // Header 顯示
  const header = useMemo(() => {
    if (!visibleMonth) return { year: '', month: '' };
    const d = new Date(Date.UTC(visibleMonth.year, visibleMonth.month - 1, 1));
    return {
      year: String(d.getUTCFullYear()),
      month: d
        .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
        .toUpperCase(),
    };
  }, [visibleMonth]);

  // 點選日期
  const setSelectedDateAndMark = useCallback(
    (dateISODate: string) => {
      const nextSelected = ensureISODateTime(dateISODate);
      console.log('[CustomCalendar] onDayPress -> dispatch setSelectedDate:', nextSelected);
      dispatch(setSelectedDate(nextSelected));

      setMarked((prev) => {
        const next: MarkedDatesMap = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = { ...v, selected: k === dateISODate };
        }
        if (!next[dateISODate]) next[dateISODate] = { selected: true, dots: [] };
        return next;
      });
    },
    [dispatch]
  );

  // ✅ 診斷：統計 care_logs 是否有資料、是否在視窗範圍內
  const debugScanLogs = useCallback(async (petId: string | null) => {
    try {
      const total = await query<{ c: number }>('SELECT COUNT(*) AS c FROM care_logs', []);
      const minMax = await query<{ min_at: string | null; max_at: string | null }>(
        'SELECT MIN(at) AS min_at, MAX(at) AS max_at FROM care_logs',
        []
      );

      console.log('[Debug] care_logs total =', total[0]?.c ?? 0);
      console.log('[Debug] care_logs min_at =', minMax[0]?.min_at, ', max_at =', minMax[0]?.max_at);

      if (petId) {
        const totalByPet = await query<{ c: number }>(
          'SELECT COUNT(*) AS c FROM care_logs WHERE pet_id = ?',
          [petId]
        );
        const minMaxByPet = await query<{ min_at: string | null; max_at: string | null }>(
          'SELECT MIN(at) AS min_at, MAX(at) AS max_at FROM care_logs WHERE pet_id = ?',
          [petId]
        );
        console.log('[Debug] pet_id =', petId, ' care_logs =', totalByPet[0]?.c ?? 0);
        console.log('[Debug] pet min_at =', minMaxByPet[0]?.min_at, ', max_at =', minMaxByPet[0]?.max_at);
      }
    } catch (e) {
      console.warn('[Debug] scan logs failed:', e);
    }
  }, []);

  // ✅ 若 currentPetId 為 null，嘗試自動 bootstrap 第一筆寵物
  const ensurePetId = useCallback(async () => {
    if (currentPetId) return currentPetId;
    try {
      const pets = await query<{ id: string }>(
        'SELECT id FROM pets ORDER BY created_at ASC LIMIT 1',
        []
      );
      const id = pets[0]?.id ?? null;
      if (id) {
        console.log('[CustomCalendar] bootstrap currentPetId =', id);
        dispatch(setCurrentPetId(id));
        return id;
      } else {
        console.log('[CustomCalendar] no pets found in DB');
        return null;
      }
    } catch (e) {
      console.warn('[CustomCalendar] ensurePetId failed:', e);
      return null;
    }
  }, [currentPetId, dispatch]);

  // 載入資料並轉成 marked map
  const fetchAndMark = useCallback(async () => {
    if (!isFocused) return;
    setLoading(true);
    try {
      const { startISO, endISO } = buildQueryWindow();
      const today = new Date().toISOString().slice(0, 10);

      console.log('[CustomCalendar] fetch window =', startISO, '→', endISO);

      // 先確保 petId
      const petId = await ensurePetId();

      // 診斷掃描（可看到資料庫到底有沒有資料 & 範圍）
      await debugScanLogs(petId);

      const rows: CareLogRow[] = petId
        ? await listCareLogsByPetBetween(petId, startISO, endISO)
        : [];

      console.log('[CustomCalendar] fetched care_logs rows =', rows.length);

      const map = buildMarkedDates(rows, today, selectedDate);
      setMarked(map);

      if (!selectedDate) {
        const now = nowIso();
        console.log('[CustomCalendar] selectedDate is empty, init with nowIso =', now);
        dispatch(setSelectedDate(now));
      }
    } catch (e) {
      console.warn('[CustomCalendar] care_logs fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [isFocused, ensurePetId, debugScanLogs, selectedDate, dispatch]);

  useEffect(() => {
    fetchAndMark();
  }, [fetchAndMark]);

  return (
    <View style={styles.container}>
      <Calendar
        renderArrow={(direction) =>
          direction === 'left' ? (
            <Ionicons name="chevron-back-outline" size={24} color="#000" />
          ) : (
            <Ionicons name="chevron-forward-outline" size={24} color="#000" />
          )
        }
        hideExtraDays
        disableMonthChange={false}
        firstDay={1}
        hideDayNames={false}
        showWeekNumbers={false}
        onPressArrowLeft={(cb) => cb()}
        onPressArrowRight={(cb) => cb()}
        onMonthChange={(m) => setVisibleMonth({ year: m.year, month: m.month })}
        onDayPress={(d: CalDateObject) => {
          console.log('[CustomCalendar] onDayPress raw date =', d.dateString);
          setSelectedDateAndMark(d.dateString);
          setVisibleMonth({ year: d.year, month: d.month });
        }}
        disableAllTouchEventsForDisabledDays
        renderHeader={() => (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginRight: 10 }}>
              {header.year}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{header.month}</Text>
          </View>
        )}
        enableSwipeMonths
        markingType="multi-dot"
        markedDates={marked as unknown as Record<string, any>}
        displayLoadingIndicator={loading}
        monthFormat="yyyy MM"
        theme={{
          backgroundColor: '#ffffff',
          calendarBackground: '#ffffff',
          textSectionTitleColor: '#b6c1cd',
          textSectionTitleDisabledColor: '#d9e1e8',
          selectedDayBackgroundColor: '#E6EDFA',
          selectedDayTextColor: '#007FFF',
          todayTextColor: '#EE7942',
          dayTextColor: '#2d4150',
          textDisabledColor: '#d9e1e8',
          disabledArrowColor: '#d9e1e8',
          monthTextColor: 'blue',
          indicatorColor: 'blue',
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 15,
          textMonthFontSize: 14,
          textDayHeaderFontSize: 14,
        }}
      />
    </View>
  );
};

export default CustomCalendar;

const styles = StyleSheet.create({
  container: {},
});
