// src/screens/HomeScreen.tsx
import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/rootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PetsHeader from '../components/headers/PetsHeader';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentPetId, selectCurrentPetId } from '../state/slices/petsSlice';
import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../lib/db/repos/pets.repo';
import { useThemeColors } from '../styles/themesColors';

// 🆕 hooks
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useNext24HourlyWeatherByCoords } from '../hooks/useNext24HourlyWeatherByCoords';

// 🆕 Environment component
import EnvironmentSection from '../components/charts/EnvironmentSection';

// 🆕 Weight chart
import WeightHistoryChart from '../components/charts/WeightHistoryChart';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const dispatch = useDispatch();
  const currentPetId = useSelector(selectCurrentPetId);
  const { colors, isDark } = useThemeColors();

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? '#38e07b',
    }),
    [colors]
  );

  // 🐾 Pet state
  const [pet, setPet] = useState<PetWithSpeciesRow | null>(null);
  const [loading, setLoading] = useState(true);

  // 📍 Location
  const {
    coords,
    locationName,
    loading: locationLoading,
  } = useCurrentLocation();

  // 🌤 Weather + 溫度 / UVB 風險判斷
  const {
    loading: weatherLoading,
    tempRisk,
    uvbRisk,
    next24Temp,
    uviHourly,
    currentCloud,
    error: weatherError,
  } = useNext24HourlyWeatherByCoords(coords, currentPetId, { maxAgeHours: 2 });

  /** 🦎 讀取寵物資料 */
  const loadPet = useCallback(async () => {
    setLoading(true);
    try {
      if (currentPetId) {
        const row = await getPetWithSpeciesById(currentPetId);
        setPet(row);
      } else {
        const rows = await listPetsWithSpecies({ limit: 1 });
        if (rows.length > 0) {
          dispatch(setCurrentPetId(rows[0].id));
          setPet(rows[0]);
        } else {
          setPet(null);
        }
      }
    } catch (e: any) {
      Alert.alert('Database Error', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [currentPetId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadPet();
    }, [loadPet])
  );

  const speciesLabel = pet?.species_name ?? pet?.species_key ?? '—';
  const environmentLoading = locationLoading || weatherLoading;

  // 小工具：從 localIso 取出 "HH:MM"
  const formatLocalTime = useCallback((iso: string | null | undefined) => {
    if (!iso) return '--:--';
    // 期待格式類似 "2025-11-11T17:00+08:00"
    const daypart = iso.split('T')[0];
    if (!daypart) return '--:--';
    const timePart = iso.split('T')[1];
    if (!timePart) return '--:--';
    // 先取前 5 個字元（HH:MM），避免帶到秒或 offset
    const hhmm = daypart.slice(-5) + " " + timePart.slice(0, 5);
    return hhmm;
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* 🧭 Header */}
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <View style={{ width: 48 }} />
        <Text style={[styles.appTitle, { color: palette.text }]}>
          ScaleFeatherFur
        </Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => Alert.alert('Settings', 'Open settings…')}
          hitSlop={10}
        >
          <Feather
            name="settings"
            size={22}
            color={isDark ? '#d1d5db' : '#4b5563'}
          />
        </Pressable>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: palette.subText }}>
            Loading from database…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <PetsHeader />

          {/* 🩺 Care Alerts */}
          <View style={{ marginTop: 16 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Care Alerts
              </Text>
              <Text style={[styles.sectionHint, { color: palette.subText }]}>
                {speciesLabel}
              </Text>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              {/* 🌡 Temp Warning */}
              {tempRisk && tempRisk.shouldWarn && (
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
                    {tempRisk.segments.map((seg, idx) => {
                      // 根據 fromOffset / toOffset，從 hourly 拿對應的 localIso
                      const fromIso =
                        tempRisk.hourly[seg.fromOffset]?.localIso ?? null;
                      const toIso =
                        tempRisk.hourly[seg.toOffset]?.localIso ?? null;
                      const fromTime = formatLocalTime(fromIso);
                      const toTime = formatLocalTime(toIso);
                      return (
                        <Text
                          key={`temp-${idx}-${seg.risk}`}
                          style={[styles.alertSub, { color: palette.subText }]}
                        >
                          {fromTime}–{toTime} → {seg.risk}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 🌞 UVB Warning */}
              {uvbRisk && uvbRisk.shouldWarn && (
                <View style={[styles.alertRow, { marginBottom: 8 }]}>
                  <View
                    style={[
                      styles.alertIconBox,
                      { backgroundColor: 'rgba(250,204,21,0.25)' },
                    ]}
                  >
                    <Feather name="sun" size={22} color="#facc15" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: '#facc15' }]}>
                      UVB Alert
                    </Text>
                    {uvbRisk.segments.map((seg, idx) => {
                      const fromIso =
                        uvbRisk.hourly[seg.fromOffset]?.localIso ?? null;
                      const toIso =
                        uvbRisk.hourly[seg.toOffset]?.localIso ?? null;

                      const fromTime = formatLocalTime(fromIso);
                      const toTime = formatLocalTime(toIso);

                      return (
                        <Text
                          key={`uvb-${idx}-${seg.risk}`}
                          style={[styles.alertSub, { color: palette.subText }]}
                        >
                          {fromTime}–{toTime} → {seg.risk}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 🧩 Feeding */}
              <View style={styles.alertRow}>
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
                    Feeding
                  </Text>
                  <Text style={[styles.alertSub, { color: palette.subText }]}>
                    Next feeding: coming soon
                  </Text>
                </View>
              </View>

              <View style={[styles.alertRow, { marginTop: 10 }]}>
                <View
                  style={[
                    styles.alertIconBox,
                    { backgroundColor: 'rgba(56,224,123,0.2)' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="stethoscope"
                    size={22}
                    color={palette.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.text }]}>
                    Vet Checkup
                  </Text>
                  <Text style={[styles.alertSub, { color: palette.subText }]}>
                    Schedule a routine check
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 🌤 Environment：改用 component */}
          <View style={{ marginTop: 16 }}>
            <EnvironmentSection
              locationName={locationName}
              loading={environmentLoading}
              tempHourly={next24Temp}
              uviHourly={uviHourly}
              currentCloud={currentCloud}
              tempRisk={tempRisk}
              uvbRisk={uvbRisk}
            />
          </View>

          {/* ⚖️ Weight Trend */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Weight
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  paddingVertical: 12,
                  alignItems: 'center',
                },
              ]}
            >
              <WeightHistoryChart />
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* 🧱 Styles */
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16 },
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
