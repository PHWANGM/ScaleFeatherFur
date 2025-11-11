// src/components/charts/EnvironmentSection.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import LineChartSimple from './LineChartSimple';
import { useThemeColors } from '../../styles/themesColors';

type Props = {
  locationName: string;
  loading: boolean;
  tempHourly: number[];
  uviHourly: number[];
  currentCloud: number | null;
};

export default function EnvironmentSection({
  locationName,
  loading,
  tempHourly,
  uviHourly,
  currentCloud,
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
                  marginLeft: 6,
                }}
              >
                {currentCloud !== null ? `${Math.round(currentCloud)}%` : '—'}
              </Text>
            </View>

            <LineChartSimple
              title="Temperature (°C)"
              values={tempHourly}
              unit="°C"
              color={palette.primary}
            />
            <View style={{ height: 10 }} />
            <LineChartSimple
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
