// src/components/warning/CalciumWarning.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/themesColors';
import {
  evaluateCalciumScheduleForPet,
  type CalciumScheduleResult,
  type CalciumRiskKind,
} from '../../lib/compliance/calciumSchedule.service';

type Props = {
  petId: string | null;
};

const CalciumWarning: React.FC<Props> = ({ petId }) => {
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
  const [result, setResult] = useState<CalciumScheduleResult | null>(null);
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

      console.log('[CalciumWarning] start evaluate for pet', { petId });

      try {
        const r = await evaluateCalciumScheduleForPet(petId);
        if (!cancelled) {
          console.log('[CalciumWarning] result', r);
          setResult(r);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.log('[CalciumWarning] error', e);
          setError(String(e?.message ?? e));
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
    calciumEveryMeals,
    lastCalciumAt,
    mealsSinceLastCalcium,
    mealsRemainingUntilNext,
    risk,
  } = result;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '----/--/-- --:--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '----/--/-- --:--';

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');

    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  };

  const lastCalciumStr = formatDateTime(lastCalciumAt);

  // 🔧 這裡把回傳型別改成 React.ReactNode（避免 JSX namespace 問題）
  const renderRiskDescription = (r: CalciumRiskKind): React.ReactNode => {
    // 1) 沒有補鈣紀錄
    if (!lastCalciumAt) {
      return (
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          還沒有鈣質補充紀錄。
        </Text>
      );
    }

    if (r === 'overdue') {
      // 3) 超過建議餐數
      return (
        <>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            上次補鈣時間是 {lastCalciumStr}
          </Text>
          <Text style={[styles.alertSub, { color: palette.subText }]}>
            鈣質補充看起來已經延遲，請儘快檢查並補鈣。
          </Text>
        </>
      );
    }

    // 2) due_soon：顯示「上次補鈣時間 + 還差幾餐」
    const remaining =
      mealsRemainingUntilNext != null ? mealsRemainingUntilNext : null;

    return (
      <>
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          上次補鈣時間是 {lastCalciumStr}
        </Text>
        <Text style={[styles.alertSub, { color: palette.subText }]}>
          {remaining != null && calciumEveryMeals != null
            ? `距離建議下一次補鈣還有約 ${remaining} 餐。`
            : '下一次補鈣時間即將到來，請留意餵食次數。'}
        </Text>
      </>
    );
  };

  console.log('[CalciumWarning] render', {
    petId,
    risk,
    lastCalciumAt,
    mealsSinceLastCalcium,
    calciumEveryMeals,
    mealsRemainingUntilNext,
  });

  return (
    <View style={[styles.alertRow, { marginTop: 8 }]}>
      <View
        style={[
          styles.alertIconBox,
          { backgroundColor: 'rgba(56,224,123,0.2)' },
        ]}
      >
        <Feather name="activity" size={22} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: palette.text }]}>
          Calcium Reminder
        </Text>

        {renderRiskDescription(risk)}

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

export default CalciumWarning;
