// src/screens/HomeScreen.tsx
import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/rootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StatsContainer from '../components/container/StatsContainer';
import PetPickerModal from '../components/modals/PetPickerModal';

import { useDispatch, useSelector } from 'react-redux';
import { setCurrentPetId, selectCurrentPetId } from '../state/slices/petsSlice';

// 🔹 使用 JOIN 版
import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../lib/db/repos/pets.repo';

import { ageCalculator } from '../lib/db/repos/_helpers';
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

  const [pet, setPet] = useState<PetWithSpeciesRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPicker, setShowPicker] = useState(false);

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

  const handleSelectPet = useCallback(
    (p: PetWithSpeciesRow) => {
      dispatch(setCurrentPetId(p.id));
      setPet(p);
      setShowPicker(false);
    },
    [dispatch]
  );

  const avatarUri = pet?.avatar_uri ?? 'https://picsum.photos/seed/sff-avatar/200/200';
  const titleName = pet?.name ?? 'No pet yet';
  const speciesLabel = pet?.species_name ?? pet?.species_key ?? '—';
  const ageLabel = ageCalculator(pet?.birth_date, { compact: true });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']} // ⬅️ 讓內容避開上方瀏海/狀態列
    >
      {/* Header */}
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
          {/* Pet header */}
          <View style={styles.petRow}>
            <Pressable onPress={() => setShowPicker(true)}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.petName, { color: palette.text }]}>{titleName}</Text>
              <Text style={[styles.petMeta, { color: palette.subText }]}>{speciesLabel}</Text>
              {!!ageLabel && (
                <Text style={[styles.petMeta, { color: palette.subText }]}>Age: {ageLabel}</Text>
              )}
            </View>
          </View>

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

          {/* 快速新增入口 */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => navigation.navigate('Plus')}
          >
            <Feather name="plus" size={20} color="#122017" />
            <Text style={styles.addButtonText}>Add Care / Log</Text>
          </Pressable>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <PetPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectPet}
      />
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
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginRight: 16 },
  petName: { fontSize: 24, fontWeight: '800' },
  petMeta: { fontSize: 14, marginTop: 2 },
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
  addButton: {
    height: 44, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12,
  },
  addButtonText: { fontSize: 15, fontWeight: '700', color: '#122017' },
});
