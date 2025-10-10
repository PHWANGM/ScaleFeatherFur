import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// ✅ 直接用你的 repo：型別、查詢函式來自這裡
import { listPets, type PetRow } from '../../lib/db/repos/pets.repo';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (pet: PetRow) => void;
  /** 可選：過濾條件（若未來需要就傳進來，不需要也可忽略） */
  filter?: {
    species_key?: string;
    habitat?: 'indoor_uvb' | 'outdoor_sun' | 'mixed';
    nameLike?: string;
  };
};

export default function PetPickerModal({ visible, onClose, onSelect, filter }: Props) {
  const [pets, setPets] = useState<PetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPets = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ 使用 repo 提供的 listPets，而不是自己組 SQL
      const rows = await listPets({
        species_key: filter?.species_key,
        habitat: filter?.habitat,
        nameLike: filter?.nameLike,
        limit: 100,
        offset: 0,
      });
      setPets(rows);
    } catch (e) {
      console.warn('[PetPickerModal] loadPets failed:', e);
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [filter?.species_key, filter?.habitat, filter?.nameLike]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await listPets({
        species_key: filter?.species_key,
        habitat: filter?.habitat,
        nameLike: filter?.nameLike,
        limit: 100,
        offset: 0,
      });
      setPets(rows);
    } catch (e) {
      console.warn('[PetPickerModal] refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  }, [filter?.species_key, filter?.habitat, filter?.nameLike]);

  useEffect(() => {
    if (visible) loadPets();
  }, [visible, loadPets]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select a Pet</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} />
            </Pressable>
          </View>

          {loading && <Text style={styles.loading}>Loading...</Text>}

          {!loading && pets.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No pets yet. Add one?</Text>
            </View>
          )}

          <FlatList
            data={pets}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                onPress={() => onSelect(item)}
              >
                <Image
                  source={{ uri: item.avatar_uri || 'https://placekitten.com/200/200' }}
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.species_key}
                    {item.location_city ? ` · ${item.location_city}` : ''}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#6b7280" />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 16, fontWeight: '700' },
  loading: { padding: 16, textAlign: 'center', color: '#6b7280' },
  emptyBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
});
