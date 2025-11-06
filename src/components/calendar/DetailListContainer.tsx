import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import DetailListItem from './DetailListItems';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
} from '../../lib/db/repos/care.logs';
import {
  selectCurrentPetId,
  selectSelectedDate,
  setCurrentPetId,
} from '../../state/slices/petsSlice';
import { query } from '../../lib/db/db.client';

// 以「本地時區」計算當日 00:00～次日 00:00，並轉成 UTC ISO
function dayRangeIsoLocal(dateStrYYYYMMDD: string): [string, string] {
  const [y, m, d] = dateStrYYYYMMDD.split('-').map(Number);
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endLocal   = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return [startLocal.toISOString(), endLocal.toISOString()];
}

const DetailListContainer: React.FC = () => {
  const isFocused = useIsFocused();
  const dispatch = useDispatch();

  const selectedDate = useSelector(selectSelectedDate) as string | null;
  const currentPetId = useSelector(selectCurrentPetId) as string | null;

  const [data, setData] = useState<CareLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  // 自救式 bootstrap：若沒有 petId，就從 DB 撈第一筆
  const ensurePetId = useCallback(async () => {
    if (currentPetId) return currentPetId;
    setBootstrapping(true);
    try {
      const pets = await query<{ id: string }>(
        'SELECT id FROM pets ORDER BY created_at ASC LIMIT 1',
        []
      );
      const id = pets[0]?.id ?? null;
      console.log('[DetailListContainer] bootstrap currentPetId =', id);
      if (id) dispatch(setCurrentPetId(id));
      return id;
    } catch (e) {
      console.warn('[DetailListContainer] ensurePetId failed:', e);
      return null;
    } finally {
      setBootstrapping(false);
    }
  }, [currentPetId, dispatch]);

  const fetchForSelectedDate = useCallback(async () => {
    const petId = await ensurePetId();
    if (!petId) {
      console.log('[DetailListContainer] skip: currentPetId is null (after ensure)');
      setData([]);
      return;
    }

    const iso = selectedDate ?? new Date().toISOString();
    const dateStr = iso.slice(0, 10);
    const [dayStartISO, dayEndISO] = dayRangeIsoLocal(dateStr);

    setLoading(true);
    try {
      const rows = await listCareLogsByPetBetween(petId, dayStartISO, dayEndISO);
      rows.sort((a, b) => a.at.localeCompare(b.at));
      setData(rows);

      console.log('[DetailListContainer] pet =', petId);
      console.log('[DetailListContainer] selectedDate =', selectedDate);
      console.log('[DetailListContainer] range =', dayStartISO, '→', dayEndISO);
      console.log('[DetailListContainer] rows.length =', rows.length);
      if (rows.length) {
        console.log('[DetailListContainer] first =', rows[0].at, ', last =', rows[rows.length - 1].at);
      }
    } catch (e) {
      console.warn('[DetailListContainer] fetch care logs failed:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [ensurePetId, selectedDate]);

  // 聚焦或依賴變更時重抓
  useEffect(() => {
    if (isFocused) {
      fetchForSelectedDate();
    }
  }, [isFocused, fetchForSelectedDate]);

  const handleDeleted = (id: string) => {
    setData((prev) => prev.filter((row) => row.id !== id));
  };

  if (bootstrapping) {
    return (
      <View style={[styles.itemListContainer, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.itemListContainer}>
      {data.length > 0 ? (
        <FlatList
          style={styles.flatList}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DetailListItem item={item} onDeleted={handleDeleted} />
          )}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchForSelectedDate}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="sad-outline" size={40} color="#A2AEBE" />
          <Text style={styles.emptyText}>
            {loading ? 'Loading...' : 'No care logs for this day'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default DetailListContainer;

const styles = StyleSheet.create({
  itemListContainer: {
    width: '90%',
    alignSelf: 'center',
    marginTop: 10,
    flex: 1,
  },
  flatList: {},
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    flexDirection: 'column',
    flex: 1,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontSize: 15,
    color: '#A2AEBE',
    marginTop: 10,
    fontWeight: '600',
  },
});
