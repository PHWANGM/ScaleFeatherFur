// src/components/charts/EnvironmentSection.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LineChartTemp from './LineChartTemp';
import { useThemeColors } from '../../styles/themesColors';
import type { Next24hTempRiskResult } from '../../lib/compliance/envTempForecast.service';

type Props = {
  locationName: string;
  loading: boolean;
  tempHourly: number[];
  uviHourly: number[];
  currentCloud: number | null;
  /** 可選：接下來 24h 的溫度風險（用來顯示 species 對應的預警） */
  tempRisk?: Next24hTempRiskResult | null;
};

export default function EnvironmentSection({
  locationName,
  loading,
  tempHourly,
  uviHourly,
  currentCloud,
  tempRisk,
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

  const hasRiskInfo = !!tempRisk;
  const shouldWarn = tempRisk?.shouldWarn ?? false;

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

            {/* 若有 species 溫度風險資訊，顯示一行摘要 */}
            {hasRiskInfo && (
              <View style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: shouldWarn ? '#f97373' : palette.subText,
                  }}
                >
                  {shouldWarn
                    ? `⚠ 接下來 ${tempRisk?.hoursChecked ?? 0} 小時內，環境溫度有可能過冷或過熱。`
                    : `✅ 接下來 ${tempRisk?.hoursChecked ?? 0} 小時內，環境溫度大致落在安全範圍。`}
                </Text>
                {tempRisk?.ambientMin != null &&
                  tempRisk?.ambientMax != null && (
                    <Text
                      style={{
                        fontSize: 12,
                        marginTop: 2,
                        color: palette.subText,
                      }}
                    >
                      Target ambient: {tempRisk.ambientMin}–
                      {tempRisk.ambientMax} °C
                    </Text>
                  )}
              </View>
            )}

            {/* 溫度與 UV 折線圖 */}
            <LineChartTemp
              title="Temperature (°C)"
              values={tempHourly}
              unit="°C"
              color={palette.primary}
              tempRisk={tempRisk} // ✅ 加這行
            />
            <View style={{ height: 10 }} />
            <LineChartTemp
              title="UV Index"
              values={uviHourly}
              color={isDark ? '#fbbf24' : '#b45309'}
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
