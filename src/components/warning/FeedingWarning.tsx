// src/components/warning/FeedingWarning.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/themesColors';
import {
  evaluateFeedingScheduleForPet,
  type FeedingScheduleResult,
  type FeedingRiskKind,
} from '../../lib/compliance/feedingSchedule.service';

type Props = {
  petId: string | null;
};

const FeedingWarning: React.FC<Props> = ({ petId }) => {
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
  const [result, setResult] = useState<FeedingScheduleResult | null>(null);
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
        const r = await evaluateFeedingScheduleForPet(petId);

        console.log('[FeedingWarning] schedule result', { petId, r });

        if (!cancelled) {
          setResult(r);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(String(e?.message ?? e));
        }
        console.log('[FeedingWarning] error evaluating feeding schedule', {
          petId,
          error: e,
        });
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
    feedingIntervalMinHours,
    feedingIntervalMaxHours,
    lastFeedAt,
    hoursSinceLastFeed,
    nextFeedWindowStart,
    nextFeedWindowEnd,
    risk,
  } = result;

  // 解析 ISO → YYYY/MM/DD HH:MM
  const formatFullLocal = (iso: string | null): string => {
    if (!iso) return '--/--/-- --:--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--/--/-- --:--';

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());

    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  };

  const lastFeedFullStr = formatFullLocal(lastFeedAt);

  // === 倒數：距離 now 還有幾小時 ===
  const diffHoursFromNow = (iso: string | null): number | null => {
    if (!iso) return null;
    const now = new Date();
    const target = new Date(iso);
    const diffMs = target.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const hoursToStart = diffHoursFromNow(nextFeedWindowStart);
  const hoursToEnd = diffHoursFromNow(nextFeedWindowEnd);

  const formatCountdownRange = (
    from: number | null,
    to: number | null
  ): string | null => {
    if (from == null || to == null) return null;

    const fromClamped = Math.max(from, 0);
    const toClamped = Math.max(to, 0);

    return `${fromClamped.toFixed(1)}–${toClamped.toFixed(1)} 小時`;
  };

  // === 三種訊息：用兩行 line1 / line2 來表達 ===
  let line1: string | null = null;
  let line2: string | null = null;

  if (!lastFeedAt) {
    // 2) 如果沒有餵食過的話
    line1 = '還沒有餵食紀錄';
    line2 = null;
  } else if (risk === 'overdue') {
    // 3) 已經超過時間
    line1 = '餵食看起來已經延遲，請儘快檢查並餵食。';
    line2 = null;
  } else {
    // 1) 有餵食紀錄 + due_soon：分成兩行
    const range = formatCountdownRange(hoursToStart, hoursToEnd);

    line1 = `上次餵食時間是 ${lastFeedFullStr}`;
    line2 = range
      ? `距離建議餵食時間窗還有約 ${range}。`
      : null;
  }

  console.log('[FeedingWarning] messageLines', {
    petId,
    risk,
    hoursSinceLastFeed,
    feedingIntervalMinHours,
    feedingIntervalMaxHours,
    lastFeedAt,
    line1,
    line2,
  });

  return (
    <View style={[styles.alertRow, { marginTop: 8 }]}>
      <View
        style={[
          styles.alertIconBox,
          { backgroundColor: 'rgba(56,224,123,0.2)' },
        ]}
      >
        <Feather name="cloud" size={22} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: palette.text }]}>
          Feeding Reminder
        </Text>

        {line1 && (
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            {line1}
          </Text>
        )}

        {line2 && (
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            {line2}
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

export default FeedingWarning;
