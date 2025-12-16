// src/components/warning/VitaminD3Warning.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/themesColors';
import {
  evaluateVitaminD3ScheduleForPet,
  type VitaminD3ScheduleResult,
  type VitaminD3RiskKind,
} from '../../lib/compliance/vitaminD3Schedule.service';

type Props = {
  petId: string | null;
};

const VitaminD3Warning: React.FC<Props> = ({ petId }) => {
  const { colors } = useThemeColors();

  const palette = useMemo(
    () => ({
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      primary: colors.primary ?? '#38e07b',
    }),
    [colors]
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VitaminD3ScheduleResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!petId) {
        setResult(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const r = await evaluateVitaminD3ScheduleForPet(petId);
        if (!cancelled) {
          setResult(r);
          console.log('[VitaminD3Warning] schedule result', r);
        }
      } catch (e: any) {
        if (!cancelled) {
          const msg = String(e?.message ?? e);
          setError(msg);
          console.log('[VitaminD3Warning] error', msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [petId]);

  if (!petId) return null;
  if (loading && !result) return null;
  if (!result) return null;
  if (!result.shouldWarn) return null;

  const {
    vitaminIntervalMinDays,
    vitaminIntervalMaxDays,
    lastVitaminAt,
    nextVitaminWindowStart,
    nextVitaminWindowEnd,
    risk,
  } = result;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
  };

  const lastVitaminTimeStr = formatDateTime(lastVitaminAt);

  // diff in days from now
  const diffDaysFromNow = (iso: string | null): number | null => {
    if (!iso) return null;
    const now = new Date();
    const target = new Date(iso);
    const diffMs = target.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60 * 24);
  };

  const daysToStart = diffDaysFromNow(nextVitaminWindowStart);
  const daysToEnd = diffDaysFromNow(nextVitaminWindowEnd);

  const formatCountdownRange = (
    from: number | null,
    to: number | null
  ): string | null => {
    if (from == null || to == null) return null;
    const fromClamped = Math.max(from, 0);
    const toClamped = Math.max(to, 0);
    return `${fromClamped.toFixed(1)}–${toClamped.toFixed(1)} 天`;
  };

  const rangeStr = formatCountdownRange(daysToStart, daysToEnd);

  const renderMainText = (r: VitaminD3RiskKind) => {
    // 2) 沒有任何紀錄
    if (!lastVitaminAt) {
      return (
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          尚未有 D3 補充紀錄，完成一次補充後記得新增紀錄。
        </Text>
      );
    }

    // 3) 已超過 max interval
    if (r === 'overdue') {
      return (
        <>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            上次 D3 補充時間是 {lastVitaminTimeStr}
          </Text>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            D3 補充看起來已經延遲，請儘快檢查並補充。
          </Text>
        </>
      );
    }

    // 1) 有紀錄且尚未超過 max interval（due_soon）
    if (rangeStr) {
      return (
        <>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            上次 D3 補充時間是 {lastVitaminTimeStr}
          </Text>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            距離建議 D3 補充時間窗還有約 {rangeStr}。
          </Text>
        </>
      );
    }

    // fallback
    return (
      <>
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          上次 D3 補充時間是 {lastVitaminTimeStr}
        </Text>
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          D3 補充時間即將到來，請準備補充。
        </Text>
      </>
    );
  };

  const frequencyLine =
    vitaminIntervalMinDays != null || vitaminIntervalMaxDays != null
      ? `建議 D3 補充頻率：約每 ${
          vitaminIntervalMinDays ?? '?'
        }–${vitaminIntervalMaxDays ?? '?'} 天一次。`
      : null;

  return (
    <View style={[styles.alertRow, { marginTop: 8 }]}>
      <View
        style={[
          styles.alertIconBox,
          { backgroundColor: 'rgba(96,165,250,0.2)' },
        ]}
      >
        <Feather name="activity" size={22} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: palette.text }]}>
          Vitamin D3 Reminder
        </Text>

        {renderMainText(risk)}

        {frequencyLine && (
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            {frequencyLine}
          </Text>
        )}

        {error && (
          <Text style={[styles.alertSub, { color: 'tomato' }]}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 16, fontWeight: '600' },
  alertSub: { fontSize: 12, marginTop: 2 },
});

export default VitaminD3Warning;
