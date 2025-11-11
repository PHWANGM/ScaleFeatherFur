// src/components/charts/WeightHistoryChart.tsx

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Switch } from 'react-native';
import { useSelector } from 'react-redux';

import ChartLine from './ChartLine';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
} from '../../lib/db/repos/care.logs';
import { selectCurrentPetId } from '../../state/slices/petsSlice';
import { useThemeColors } from '../../styles/themesColors';

type Point = { x: number; y: number };
type Unit = 'kg' | 'g';

export default function WeightHistoryChart() {
  const currentPetId = useSelector(selectCurrentPetId);
  const { colors } = useThemeColors();

  const [kgPoints, setKgPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>('kg');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!currentPetId) {
        setKgPoints([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const end = new Date();      // 今天
        const start = new Date(end); // 兩個月前
        start.setMonth(start.getMonth() - 2);

        const startISO = start.toISOString();
        const endISO = end.toISOString();

        const rows: CareLogRow[] = await listCareLogsByPetBetween(
          currentPetId,
          startISO,
          endISO,
          ['weigh']
        );

        if (cancelled) return;

        const validRows = rows.filter(r => r.value != null);

        // 每天只取最後一筆
        const lastByDay: Record<string, CareLogRow> = {};
        for (const r of validRows) {
          const dayKey = r.at.slice(0, 10); // YYYY-MM-DD
          const existing = lastByDay[dayKey];
          if (!existing || r.at > existing.at) {
            lastByDay[dayKey] = r;
          }
        }

        const sortedDays = Object.keys(lastByDay).sort();

        const pts: Point[] = sortedDays.map(dayKey => {
          const log = lastByDay[dayKey];
          return {
            x: new Date(log.at).getTime(),
            y: log.value as number, // 假設 DB 中 value 存的是 kg
          };
        });

        setKgPoints(pts);
      } catch (e) {
        console.error('Failed to load weight logs', e);
        if (!cancelled) setError('無法載入體重資料');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [currentPetId]);

  const displayPoints: Point[] = useMemo(
    () =>
      unit === 'kg'
        ? kgPoints
        : kgPoints.map(p => ({ x: p.x, y: p.y * 1000 })), // kg -> g
    [kgPoints, unit]
  );

  const yFormatter = (v: number) => {
    if (unit === 'kg') {
      return `${v.toFixed(2)}`;
    }
    // g 的時候通常不用小數
    return `${Math.round(v)}`;
  };

  if (!currentPetId) {
    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: colors.subText ?? '#6B7280' }]}>
          請先選擇一隻寵物
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: colors.subText ?? '#EF4444' }]}>
          {error}
        </Text>
      </View>
    );
  }

  if (!displayPoints || displayPoints.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: colors.subText ?? '#6B7280' }]}>
          最近兩個月沒有體重紀錄
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* 標題 + 單位切換 */}
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.title,
            { color: colors.text },
          ]}
        >
          最近兩個月體重變化（每日最後一次）
        </Text>
        <View style={styles.unitRow}>
          <Text
            style={[
              styles.unitLabel,
              { color: colors.subText ?? '#6B7280' },
            ]}
          >
            kg
          </Text>
          <Switch
            value={unit === 'g'}
            onValueChange={val => setUnit(val ? 'g' : 'kg')}
          />
          <Text
            style={[
              styles.unitLabel,
              { color: colors.subText ?? '#6B7280' },
            ]}
          >
            g
          </Text>
        </View>
      </View>

      <ChartLine
        data={displayPoints}
        width={340}
        height={160}
        showDots
        showXAxis
        showYAxis
        yFormatter={yFormatter}
        yTicks={4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unitLabel: {
    fontSize: 12,
  },
});
