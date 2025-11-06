// src/components/modals/PetPickerModal.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, FlatList, Image,
  RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { listPetsWithSpecies, type PetWithSpeciesRow } from '../../lib/db/repos/pets.repo';
import { useThemeColors } from '../../styles/themesColors';
import { setCurrentPetId, selectCurrentPetId } from '../../state/slices/petsSlice';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (pet: PetWithSpeciesRow) => void;
  filter?: {
    species_key?: string;
    habitat?: 'indoor_uvb' | 'outdoor_sun' | 'mixed';
    nameLike?: string;
  };
};

export default function PetPickerModal({ visible, onClose, onSelect, filter }: Props) {
  const { colors } = useThemeColors();
  const dispatch = useDispatch();
  const currentPetId = useSelector(selectCurrentPetId); // ← Redux state

  const palette = useMemo(() => ({
    bg: colors.bg,
    card: colors.card,
    text: colors.text,
    subText: colors.subText ?? colors.textDim ?? '#97A3B6',
    border: colors.border,
    primary: colors.primary ?? '#38e07b',
  }), [colors]);

  const [pets, setPets] = useState<PetWithSpeciesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ✅ 每次 currentPetId 改變時，輸出目前選擇的寵物 ID
  useEffect(() => {
    if (currentPetId) {
      console.log('[PetPickerModal] Current pet ID changed:', currentPetId);
    }
  }, [currentPetId]);

  const loadPets = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPetsWithSpecies({
        species_key: filter?.species_key,
        habitat: filter?.habitat,
        nameLike: filter?.nameLike,
        limit: 100,
        offset: 0,
      });
      if (mountedRef.current) setPets(rows);
    } catch (e) {
      console.warn('[PetPickerModal] loadPets failed:', e);
      if (mountedRef.current) setPets([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filter?.species_key, filter?.habitat, filter?.nameLike]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await listPetsWithSpecies({
        species_key: filter?.species_key,
        habitat: filter?.habitat,
        nameLike: filter?.nameLike,
        limit: 100,
        offset: 0,
      });
      if (mountedRef.current) setPets(rows);
    } catch (e) {
      console.warn('[PetPickerModal] refresh failed:', e);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [filter?.species_key, filter?.habitat, filter?.nameLike]);

  useEffect(() => {
    if (visible) loadPets();
  }, [visible, loadPets]);

  const handleSelect = useCallback(
    async (pet: PetWithSpeciesRow) => {
      try {
        const idStr = String(pet.id);
        setSelectingId(idStr); // 防止連點
        const res: any = dispatch(setCurrentPetId(idStr));
        if (res && typeof res.then === 'function') {
          await res;
        }
        onSelect(pet);
        console.log('[PetPickerModal] Current pet ID changed:', currentPetId);
      } catch (e) {
        console.warn('[PetPickerModal] handleSelect failed:', e);
      } finally {
        setSelectingId(null);
        onClose();
      }
    },
    [dispatch, onSelect, onClose]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: 'rgba(255, 255, 255, 1)' }]}
          onPress={() => {}}
        >
          <View
            style={[
              styles.header,
              { borderBottomColor: palette.border, backgroundColor: palette.card },
            ]}
          >
            <Text style={[styles.title, { color: palette.text }]}>Select a Pet</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={palette.subText} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={palette.primary} />
              <Text style={[styles.loading, { color: palette.subText }]}>Loading...</Text>
            </View>
          ) : pets.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="alert-circle" size={18} color={palette.subText} />
              <Text style={[styles.emptyText, { color: palette.subText }]}>
                No pets yet. Add one?
              </Text>
            </View>
          ) : (
            <FlatList
              data={pets}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              }
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: palette.border }]} />
              )}
              contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 24 : 12 }}
              renderItem={({ item }) => {

                const idStr = String(item.id);
                const selected = currentPetId === idStr;
                const disabled = selectingId === idStr;

                const speciesLabel = item.species_name ?? item.species_key ?? '—';
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { opacity: 0.7 },
                      selected && { backgroundColor: 'rgba(56, 224, 123, 0.08)' },
                    ]}
                    onPress={() => (disabled ? null : handleSelect(item))}
                  >
                    <Image
                      source={{ uri: item.avatar_uri || 'https://placekitten.com/200/200' }}
                      style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.meta, { color: palette.subText }]} numberOfLines={1}>
                        {speciesLabel}
                        {item.location_city ? ` · ${item.location_city}` : ''}
                      </Text>
                    </View>

                    {selected ? (
                      <Feather name="check" size={18} color={palette.primary} />
                    ) : (
                      <Feather name="chevron-right" size={18} color={palette.subText} />
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%', paddingBottom: 12,
    ...Platform.select({
      ios: { shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 10 },
    }),
  },
  header: {
    paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  loading: { marginTop: 8, textAlign: 'center' },
  centerBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#ddd' },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
});
