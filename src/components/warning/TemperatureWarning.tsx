// src/components/warning/TemperatureWarning.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/themesColors';
import type {
  Next24hTempRiskResult,
  TempRiskKind,
  TempRiskSegment,
} from '../../lib/compliance/envTempForecast.service';

type Props = {
  /** 來自 useNext24HourlyWeatherByCoords 的 tempRisk */
  tempRisk: Next24hTempRiskResult | null | undefined;
};

const TemperatureWarning: React.FC<Props> = ({ tempRisk }) => {
  const { colors } = useThemeColors();

  const palette = useMemo(
    () => ({
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
    }),
    [colors]
  );

  // 沒有風險結果或根本不需要警示 → 不顯示
  if (!tempRisk || !tempRisk.shouldWarn) return null;

  const { segments = [], hourly = [], ambientMin, ambientMax } = tempRisk;

  // ⚠️ 跟原本 HomeScreen 一樣：不過濾 risk，全部 segments 都列出來
  const shownSegments: TempRiskSegment[] = segments;

  if (shownSegments.length === 0) return null;

  // --- 小工具：格式化「小時」為 HH:00 ---

  const formatHour = (hour: number | null): string => {
    if (hour == null || Number.isNaN(hour) || hour < 0 || hour > 23) {
      return '--:--';
    }
    const hh = String(hour).padStart(2, '0');
    return `${hh}:00`;
  };

  // 如果 fromHour / toHour 沒有值，就 fallback 用 localIso 解析 HH:MM
  const formatTimeFromFallbackIso = (iso: string | null | undefined) => {
    if (!iso) return '--:--';
    const parts = iso.split('T');
    if (parts.length < 2) return '--:--';
    const timePart = parts[1]; // e.g. "17:00+08:00" / "17:00:30+08:00"
    return timePart.slice(0, 5); // "17:00"
  };

  const formatSegmentTimeRange = (seg: TempRiskSegment): { from: string; to: string } => {
    const from =
      seg.fromHour != null
        ? formatHour(seg.fromHour)
        : formatTimeFromFallbackIso(hourly[seg.fromOffset]?.localIso);
    const to =
      seg.toHour != null
        ? formatHour(seg.toHour)
        : formatTimeFromFallbackIso(hourly[seg.toOffset]?.localIso);
    return { from, to };
  };

  const riskLabelMap: Record<TempRiskKind, string> = {
    ok: 'ok',
    too_cold: 'too cold',
    too_hot: 'too hot',
    unknown: 'unknown',
  };

  return (
    <View style={[styles.alertRow, { marginBottom: 8 }]}>
      <View
        style={[
          styles.alertIconBox,
          { backgroundColor: 'rgba(255,99,99,0.2)' },
        ]}
      >
        <Feather name="thermometer" size={22} color="#ff6363" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: '#ff6363' }]}>
          Temperature Alert
        </Text>

        {shownSegments.map((seg, idx) => {
          const { from, to } = formatSegmentTimeRange(seg);
          const riskText = riskLabelMap[seg.risk];

          return (
            <Text
              key={`temp-${idx}-${seg.fromOffset}-${seg.toOffset}`}
              style={[styles.alertSub, { color: palette.subText }]}
            >
              {from}–{to} → {riskText}
            </Text>
          );
        })}
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

export default TemperatureWarning;
