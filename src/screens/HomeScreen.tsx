// src/screens/HomeScreen.tsx
import { useMemo, useState, useCallback, useEffect } from 'react';
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
import * as Location from 'expo-location'; // ✅ 新增：取得當前位置

import StatsContainer from '../components/container/StatsContainer';
import PetsHeader from '../components/headers/PetsHeader';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentPetId, selectCurrentPetId } from '../state/slices/petsSlice';
import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../lib/db/repos/pets.repo';

// ✅ 天氣資料來源
import { ensureTodayHourly } from '../lib/db/services/weather.service';
import LineChartSimple from '../components/charts/LineChartSimple';
import { useThemeColors } from '../styles/themesColors';

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
      subText: colors.subText ?? colors.textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? '#38e07b',
    }),
    [colors]
  );

  // 🐾 Pet state
  const [pet, setPet] = useState<PetWithSpeciesRow | null>(null);
  const [loading, setLoading] = useState(true);

  // 🌤 Weather state
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [tempHourly, setTempHourly] = useState<number[]>([]);
  const [uviHourly, setUviHourly] = useState<number[]>([]);
  const [currentCloud, setCurrentCloud] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('Locating...');

  /** 🧭 抓目前地點名稱 */
  const loadLocationName = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('Permission denied');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) {
        const city = place.city || place.subregion || '';
        const region = place.region || '';
        const country = place.country || '';
        setLocationName(
          [city, region || country].filter(Boolean).join(', ') || 'Unknown'
        );
      } else {
        setLocationName('Unknown');
      }
    } catch (err) {
      console.warn('location error:', err);
      setLocationName('Unknown');
    }
  }, []);

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

  /** ☀️ 讀取天氣資料 */
  const loadWeather = useCallback(async () => {
    try {
      setWeatherLoading(true);
      const { hourly } = await ensureTodayHourly({ maxAgeHours: 2 });
      const hr = new Date().getHours();
      setTempHourly(Array.isArray(hourly.temperature) ? hourly.temperature : []);
      setUviHourly(Array.isArray(hourly.uvIndex) ? hourly.uvIndex : []);
      const cc =
        Array.isArray(hourly.cloudcover) && hourly.cloudcover.length > hr
          ? hourly.cloudcover[hr]
          : null;
      setCurrentCloud(cc);
    } catch (e: any) {
      console.warn('weather load error:', e?.message ?? e);
      setTempHourly([]);
      setUviHourly([]);
      setCurrentCloud(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPet();
      loadLocationName();
    }, [loadPet, loadLocationName])
  );

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  const speciesLabel = pet?.species_name ?? pet?.species_key ?? '—';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* 🧭 Header */}
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <View style={{ width: 48 }} />
        <Text style={[styles.appTitle, { color: palette.text }]}>ScaleFeatherFur</Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => Alert.alert('Settings', 'Open settings…')}
          hitSlop={10}
        >
          <Feather name="settings" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Care Alerts
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
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

          {/* 🌤 Environment */}
          <View style={{ marginTop: 16 }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Environment
              </Text>
              <Text style={[styles.sectionHint, { color: palette.subText }]}>
                {locationName}
              </Text>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              {weatherLoading ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: palette.subText }}>
                    Loading hourly weather…
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
                      {currentCloud !== null
                        ? `${Math.round(currentCloud)}%`
                        : '—'}
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

          {/* 📊 Daily Stats */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Daily Stats
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  paddingVertical: 10,
                },
              ]}
            >
              <StatsContainer />
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
  card: { borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth },
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
