import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/rootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatsContainer from '../components/container/StatsContainer';
import PetsHeader from '../components/headers/PetsHeader';

import { useDispatch, useSelector } from 'react-redux';
import { setCurrentPetId, selectCurrentPetId } from '../state/slices/petsSlice';

import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../lib/db/repos/pets.repo';

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

  // 仍保留這段：用於 Resources 區塊顯示 species 名稱
  const [pet, setPet] = useState<PetWithSpeciesRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
      setPet(null);
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* App header */}
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
          <Text style={{ marginTop: 8, color: palette.subText }}>Loading from database…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ✅ 共用 PetsHeader（與 Logs 一致） */}
          <PetsHeader/>

          {/* Care Alerts */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Care Alerts</Text>
            <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.alertRow}>
                <View style={[styles.alertIconBox, { backgroundColor: 'rgba(56,224,123,0.2)' }]}>
                  <Feather name="cloud" size={22} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.text }]}>Feeding</Text>
                  <Text style={[styles.alertSub, { color: palette.subText }]}>
                    Next feeding: coming soon
                  </Text>
                </View>
              </View>

              <View style={[styles.alertRow, { marginTop: 10 }]}>
                <View style={[styles.alertIconBox, { backgroundColor: 'rgba(56,224,123,0.2)' }]}>
                  <MaterialCommunityIcons name="stethoscope" size={22} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.text }]}>Vet Checkup</Text>
                  <Text style={[styles.alertSub, { color: palette.subText }]}>
                    Schedule a routine check
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Daily Stats */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Daily Stats</Text>
            <View
              style={[
                styles.card,
                { backgroundColor: palette.card, borderColor: palette.border, paddingVertical: 10 },
              ]}
            >
              <StatsContainer />
            </View>
          </View>

          {/* Resources */}
          <View style={{ marginTop: 16, marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Resources</Text>
            <Pressable
              style={({ pressed }) => [
                styles.resourceRow,
                { backgroundColor: palette.card, borderColor: palette.border },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => navigation.navigate('Community')}
            >
              <View style={[styles.resourceIconBox, { backgroundColor: 'rgba(56,224,123,0.2)' }]}>
                <Feather name="book-open" size={20} color={palette.primary} />
              </View>
              <Text style={[styles.resourceLabel, { color: palette.text }]}>{speciesLabel} Care Guide</Text>
              <Feather name="chevron-right" size={18} color={palette.subText} />
            </Pressable>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 16 },

  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  card: { borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIconBox: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  alertTitle: { fontSize: 16, fontWeight: '600' },
  alertSub: { fontSize: 12, marginTop: 2 },
  resourceRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resourceIconBox: {
    width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  resourceLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
});
