// src/components/CustomCalendar.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';

import {
  setSelectedDate,
  selectCurrentPetId,
  selectSelectedDate,
} from '../../state/slices/petsSlice';
import { nowIso } from '../../lib/db/repos/_helpers';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
  type CareLogType,
} from '../../lib/db/repos/care.logs';

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
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const ensureISODateTime = (isoLike: string) =>
  isoLike.includes('T') ? isoLike : `${isoLike}T${new Date().toISOString().split('T')[1]}`;

const buildQueryWindow = () => {
  // 6 個月內到明日 00:00
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 6);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

// 確保 map[day] 一定存在（避免 'never' 問題）
function ensureDay(map: MarkedDatesMap, day: string): MultiDotMark {
  if (!map[day]) map[day] = { selected: false, dots: [] };
  else if (!map[day].dots) map[day].dots = [];
  return map[day];
}

// 建構 markedDates（含去重）
function buildMarkedDates(
  rows: CareLogRow[],
  todayISO: string,
  selectedISO?: string | null
): MarkedDatesMap {
  const selectedDay = selectedISO ? selectedISO.slice(0, 10) : todayISO;
  const map: MarkedDatesMap = {};

  // 先標記 selected 日（若當天沒有資料也能被選取）
  ensureDay(map, selectedDay).selected = true;

  for (const log of rows) {
    const day = log.at.slice(0, 10);
    const color = DOTS[log.type]?.color;
    if (!color) continue;

    const entry = ensureDay(map, day);
    entry.selected = day === selectedDay;

    const key = `${log.type}:${color}`;
    const exists = (entry.dots ?? []).some(d => (d.key ?? '') === key && d.color === color);
    if (!exists) {
      entry.dots!.push({ color, key });
    }
  }

  // 確保今天存在（避免沒有任何日期 selected 的狀況）
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
      month: d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }).toUpperCase(),
    };
  }, [visibleMonth]);

  // 點選日期：只更新 selected，不直接動 dots
  const setSelectedDateAndMark = useCallback((dateISODate: string) => {
    dispatch(setSelectedDate(ensureISODateTime(dateISODate)));
    setMarked(prev => {
      const next: MarkedDatesMap = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = { ...v, selected: k === dateISODate };
      }
      if (!next[dateISODate]) next[dateISODate] = { selected: true, dots: [] };
      return next;
    });
  }, [dispatch]);

  // 載入資料並轉成 marked map
  const fetchAndMark = useCallback(async () => {
    if (!isFocused) return;
    setLoading(true);
    try {
      const { startISO, endISO } = buildQueryWindow();
      const today = toISODate(new Date());

      const rows: CareLogRow[] = currentPetId
        ? await listCareLogsByPetBetween(currentPetId, startISO, endISO)
        : [];

      const map = buildMarkedDates(rows, today, selectedDate);
      setMarked(map);

      if (!selectedDate) {
        // 同步 Store 的 selectedDate（ISO DateTime）
        dispatch(setSelectedDate(nowIso()));
      }
    } catch (e) {
      console.warn('[CustomCalendar] care_logs fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [currentPetId, selectedDate, isFocused, dispatch]);

  useEffect(() => {
    fetchAndMark();
  }, [fetchAndMark]);

  return (
    <View style={styles.container}>
      <Calendar
        renderArrow={(direction) =>
          direction === 'left'
            ? <Ionicons name="chevron-back-outline" size={24} color="#000" />
            : <Ionicons name="chevron-forward-outline" size={24} color="#000" />
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
          setSelectedDateAndMark(d.dateString);
          setVisibleMonth({ year: d.year, month: d.month });
        }}
        disableAllTouchEventsForDisabledDays
        renderHeader={() => (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginRight: 10 }}>{header.year}</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{header.month}</Text>
          </View>
        )}
        enableSwipeMonths
        markingType="multi-dot"
        // react-native-calendars 的型別較寬，安全轉型一次
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
