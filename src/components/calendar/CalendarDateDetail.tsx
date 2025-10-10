// src/components/CalendarDateDetail.tsx
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import DetailListContainer from './DetailListContainer';
import { selectSelectedDate } from '../../state/slices/petsSlice'; // ← 路徑依你的實際專案調整
import type { ISODate } from '../../lib/db/repos/_helpers';

/**
 * @param isoString ISO datetime，例如 2025-10-10T08:00:00.000Z
 */
function formatReadableDate(isoString: ISODate | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  // e.g. "Oct 10" (en-US) 或 "10 Oct" (en-GB)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const CalenderDateDetail: React.FC = () => {
  const selectedDate = useSelector(selectSelectedDate) as ISODate | null;

  const displayDate = useMemo(() => formatReadableDate(selectedDate), [selectedDate]);

  return (
    <View style={styles.detailsContainer}>
      <View style={styles.detailDateContainer}>
        <Text style={styles.dateText}>{displayDate}</Text>
        <View style={styles.dateLine} />
      </View>

      {/* 當天 care_log 清單 */}
      <DetailListContainer />
    </View>
  );
};

export default CalenderDateDetail;

const styles = StyleSheet.create({
  detailsContainer: {
    flex: 1,
  },
  detailDateContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  dateText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#A2AEBE',
  },
  dateLine: {
    width: Dimensions.get('window').width * 0.65,
    height: 2,
    backgroundColor: '#A2AEBE',
  },
});
