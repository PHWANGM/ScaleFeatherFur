// src/components/headers/PetsHeader.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';

import { useThemeColors } from '../../styles/themesColors';
import { setCurrentPetId, selectCurrentPetId } from '../../state/slices/petsSlice';

// 與 HomeScreen 相同的 repo 與型別
import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../../lib/db/repos/pets.repo';

import { ageCalculator } from '../../lib/db/repos/_helpers';
import PetPickerModal from '../modals/PetPickerModal';

type Props = {
  /** 可選：想在右邊放一顆「新增紀錄」按鈕就傳這個（例如導到 NewActivity） */
  onAddPress?: () => void;
  /** 外層可選擇是否顯示右側按鈕（預設不顯示） */
  showAddButton?: boolean;
};

export default function PetsHeader({ onAddPress, showAddButton = false }: Props) {
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
      console.warn('[PetsHeader] loadPet failed:', e?.message ?? e);
      setPet(null);
    } finally {
      setLoading(false);
    }
  }, [currentPetId, dispatch]);

  useEffect(() => {
    loadPet();
  }, [loadPet]);

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
    <View style={[styles.wrap, { backgroundColor: palette.bg }]}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={[styles.loadingText, { color: palette.subText }]}>Loading pet…</Text>
        </View>
      ) : (
        <View style={styles.row}>
          {/* Avatar + 下拉角標（與 HomeScreen 一致） */}
          <View style={styles.avatarContainer}>
            <Pressable onPress={() => setShowPicker(true)} style={styles.avatarPressable}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <View style={styles.dropdownIconBox}>
                <Feather name="chevron-down" size={18} color="#fff" />
              </View>
            </Pressable>
          </View>

          {/* 名稱/物種/年齡（與 HomeScreen 一致字級） */}
          <View style={{ flex: 1 }}>
            <Text style={[styles.petName, { color: palette.text }]} numberOfLines={1}>
              {titleName}
            </Text>
            <Text style={[styles.petMeta, { color: palette.subText }]} numberOfLines={1}>
              {speciesLabel}
            </Text>
            {!!ageLabel && (
              <Text style={[styles.petMeta, { color: palette.subText }]} numberOfLines={1}>
                Age: {ageLabel}
              </Text>
            )}
          </View>

            <Pressable
              onPress={onAddPress}
              style={({ pressed }) => [
                styles.addBtn,
                { borderColor: palette.border },
                pressed && { opacity: 0.85 },
              ]}
              hitSlop={8}
            >
              <Feather
                name="plus"
                size={16}
                color={isDark ? '#d1d5db' : '#122017'}
              />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>

        </View>
      )}

      <PetPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleSelectPet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: { fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  // 與 HomeScreen 對齊
  avatarContainer: { position: 'relative' },
  avatarPressable: { width: 96, height: 96 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginRight: 16 },
  dropdownIconBox: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  petName: { fontSize: 24, fontWeight: '800' },
  petMeta: { fontSize: 14, marginTop: 2 },

  addBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: { fontSize: 13, fontWeight: '700' },
});
