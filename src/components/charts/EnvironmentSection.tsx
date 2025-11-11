// src/components/charts/EnvironmentSection.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LineChart from './LineChart';
import { useThemeColors } from '../../styles/themesColors';
import type { Next24hTempRiskResult } from '../../lib/compliance/envTempForecast.service';
import type { Next24hUvbRiskResult } from '../../lib/compliance/uvbForecast.service';

type Props = {
  locationName: string;
  loading: boolean;
  tempHourly: number[];
  uviHourly: number[];
  currentCloud: number | null;

  /** 接下來 24h 的溫度風險（ambient_temp_c_min/max） */
  tempRisk?: Next24hTempRiskResult | null;
  /** 接下來 24h 的 UVB 風險（uvb_intensity_min/max，以 uviHourly 為輸入） */
  uvbRisk?: Next24hUvbRiskResult | null;
};

export default function EnvironmentSection({
  locationName,
  loading,
  tempHourly,
  uviHourly,
  currentCloud,
  tempRisk,
  uvbRisk,
}: Props) {
  const { colors, isDark } = useThemeColors();

  const palette = {
    bg: colors.bg,
    card: colors.card,
    text: colors.text,
    subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
    border: colors.border,
    primary: colors.primary ?? '#38e07b',
  };

  const hasTempRiskInfo = !!tempRisk;
  const tempShouldWarn = tempRisk?.shouldWarn ?? false;

  const hasUvbRiskInfo = !!uvbRisk;
  const uvbShouldWarn = uvbRisk?.shouldWarn ?? false;

  return (
    <View>
      {/* 標題列 */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Environment
        </Text>
        <Text style={[styles.sectionHint, { color: palette.subText }]}>
          {locationName}
        </Text>
      </View>

      {/* 卡片本體 */}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        {loading ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: palette.subText }}>
              Loading location & weather…
            </Text>
          </View>
        ) : (
          <>
            {/* 上方：雲量 & 溫度是否在安全範圍 */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <View
                style={[
                  styles.alertIconBox,
                  {
                    backgroundColor: 'rgba(56,224,123,0.18)',
                    marginRight: 12,
                  },
                ]}
              >
                <Feather name="cloud" size={22} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 16,
                    fontWeight: '700',
                  }}
                >
                  Current Cloud Cover:
                </Text>
                <Text
                  style={{
                    color: palette.text,
                    fontSize: 16,
                    fontWeight: '800',
                    marginTop: 2,
                  }}
                >
                  {currentCloud !== null
                    ? `${Math.round(currentCloud)}%`
                    : '—'}
                </Text>
              </View>
            </View>

            {/* 溫度與 UV 折線圖 */}
            <LineChart
              title="Temperature"
              values={tempHourly}
              unit="°C"
              color={palette.primary}
              tempRisk={tempRisk}
            />
            <View style={{ height: 10 }} />
            <LineChart
              title="UV Index"
              values={uviHourly}
              color={isDark ? '#fbbf24' : '#b45309'}
              uvbRisk={uvbRisk} // ✅ 這裡讓 UV 圖也用 risk 背景著色
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionHint: { fontSize: 14, fontWeight: '500' },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
