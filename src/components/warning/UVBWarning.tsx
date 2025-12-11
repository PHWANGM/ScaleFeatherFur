// src/components/warning/UVBWarning.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useThemeColors } from '../../styles/themesColors';
import type {
  Next24hUvbRiskResult,
  UvbRiskKind,
  UvbRiskSegment,
} from '../../lib/compliance/uvbForecast.service';

type Props = {
  /** 來自 useNext24HourlyWeatherByCoords 的 uvbRisk */
  uvbRisk: Next24hUvbRiskResult | null | undefined;
};

const UVBWarning: React.FC<Props> = ({ uvbRisk }) => {
  const { colors } = useThemeColors();

  const palette = useMemo(
    () => ({
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
    }),
    [colors]
  );

  // 沒有風險結果或根本不需要警示 → 不顯示
  if (!uvbRisk || !uvbRisk.shouldWarn) return null;

  const { segments = [], hourly = [], uvbMin, uvbMax } = uvbRisk;

  // ✅ 只保留 too_high / too_low 的 segments
  const dangerSegments: UvbRiskSegment[] = segments.filter(
    seg => seg.risk === 'too_high' || seg.risk === 'too_low'
  );

  if (dangerSegments.length === 0) return null;

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
    const timePart = parts[1]; // e.g. "11:00+08:00" / "11:00:30+08:00"
    return timePart.slice(0, 5); // "11:00"
  };

  const formatSegmentTimeRange = (seg: UvbRiskSegment): { from: string; to: string } => {
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

  // 讓 risk 文字好讀一點（你要英文就留英文，這裡先簡單 mapping）
  const riskLabelMap: Record<UvbRiskKind, string> = {
    ok: 'ok',
    too_low: 'too low',
    too_high: 'too high',
    unknown: 'unknown',
  };

  return (
    <View style={[styles.alertRow, { marginBottom: 8 }]}>
      {/* 左側 icon */}
      <View
        style={[
          styles.alertIconBox,
          { backgroundColor: 'rgba(250,204,21,0.25)' },
        ]}
      >
        <Feather name="sun" size={22} color="#facc15" />
      </View>

      {/* 右側文字內容 */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: '#facc15' }]}>
          UVB Alert
        </Text>

        {dangerSegments.map((seg, idx) => {
          const { from, to } = formatSegmentTimeRange(seg);
          const riskText = riskLabelMap[seg.risk];

          return (
            <Text
              key={`uvb-${idx}-${seg.fromOffset}-${seg.toOffset}`}
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

export default UVBWarning;
