// src/components/DetailListContainer.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import DetailListItem from './DetailListItems'; // ← 路徑依你的實際檔案調整
import {
  listCareLogsByPetBetween,
  type CareLogRow,
} from '../../lib/db/repos/care.logs'; // ← 路徑依你的專案調整
import { dayRangeIso } from '../../lib/db/repos/_helpers'; // ← 路徑依你的專案調整
import {
  selectCurrentPetId,
  selectSelectedDate,
} from '../../state/slices/petsSlice'; // ← 路徑依你的專案調整

const DetailListContainer: React.FC = () => {
  const isFocused = useIsFocused();

  // 建議改用你 slice 暴露的型別安全 selectors
  const selectedDate = useSelector(selectSelectedDate) as string | null;
  const currentPetId = useSelector(selectCurrentPetId) as string | null;

  const [data, setData] = useState<CareLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchForSelectedDate = useCallback(async () => {
    if (!currentPetId) {
      setData([]);
      return;
    }
    // 以 selectedDate 的日期（或今天）計算該日 [00:00, 次日00:00)
    const dateStr = (selectedDate ?? new Date().toISOString()).slice(0, 10);
    const { dayStartISO, dayEndISO } = dayRangeIso(dateStr);

    setLoading(true);
    try {
      const rows = await listCareLogsByPetBetween(currentPetId, dayStartISO, dayEndISO);
      // 依時間排序（at ASC）
      rows.sort((a, b) => a.at.localeCompare(b.at));
      setData(rows);
    } catch (e) {
      console.warn('[DetailListContainer] fetch care logs failed:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [currentPetId, selectedDate]);

  useEffect(() => {
    if (isFocused) {
      fetchForSelectedDate();
    }
  }, [isFocused, fetchForSelectedDate]);

  const handleDeleted = (id: string) => {
    // 本地快取先行移除；若需要保險可在父層觸發重新查詢
    setData((prev) => prev.filter((row) => row.id !== id));
  };

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
  emptyText: {
    fontSize: 15,
    color: '#A2AEBE',
    marginTop: 10,
    fontWeight: '600',
  },
});
