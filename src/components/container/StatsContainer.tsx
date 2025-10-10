// src/components/StatsContainer/StatsContainer.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';

import StatsBox from './StatsBox';
import {
  getDailyAggregatesSQL,
  type DailyAggregates,
} from '../../lib/db/repos/care.logs';
import { dayRangeIso } from '../../lib/db/repos/_helpers';
import { selectCurrentPetId, selectSelectedDate } from '../../state/slices/PetSlice';

const initialAgg: DailyAggregates = {
  feed_grams: 0,
  calcium_count: 0,
  uvb_hours: 0,
  weight_kg: 0,
};

const StatsContainer: React.FC = () => {
  const selectedDate = useSelector(selectSelectedDate);
  const currentPetId = useSelector(selectCurrentPetId);
  const isFocused = useIsFocused();

  const [agg, setAgg] = useState<DailyAggregates>(initialAgg);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!currentPetId) {
        setAgg(initialAgg);
        return;
      }
      setLoading(true);
      try {
        const { dayStartISO, dayEndISO } = dayRangeIso(selectedDate || undefined);
        const res = await getDailyAggregatesSQL(currentPetId, dayStartISO, dayEndISO);
        if (!cancelled) {
          const safeUvb = Number.isFinite(res?.uvb_hours)
            ? parseFloat((res.uvb_hours as number).toFixed(2))
            : 0;
          setAgg({
            feed_grams: Number(res?.feed_grams ?? 0),
            calcium_count: Number(res?.calcium_count ?? 0),
            uvb_hours: safeUvb,
            weight_kg: Number(res?.weight_kg ?? 0),
          });
        }
      } catch (err) {
        console.warn('[StatsContainer] getDailyAggregatesSQL error:', err);
        if (!cancelled) setAgg(initialAgg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (isFocused) load();
    else setAgg(initialAgg);

    return () => {
      cancelled = true;
    };
  }, [isFocused, currentPetId, selectedDate]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#FEE8DC"
              textC="#EE7942"
              activity="Feed"
              data={agg.feed_grams}
              small="g"
            />
          </View>

          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#FFEFF1"
              textC="#FD5B71"
              activity="Calcium"
              data={agg.calcium_count}
              small="x"
            />
          </View>

          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#E6EDFA"
              textC="#2871C8"
              activity="UVB"
              data={agg.uvb_hours}
              small="h"
            />
          </View>

          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#F5EEFC"
              textC="#9B51E0"
              activity="Weight"
              data={agg.weight_kg}
              small="kg"
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default StatsContainer;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',      // ⬅️ 讓整個網格置中
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',  // ⬅️ 用 center，而不是 space-between
    alignItems: 'center',
    gap: 20,                   // ⬅️ React Native 0.71+ 可用 gap，更自然
    width: '100%',              // ⬅️ 留白邊距，避免太貼邊
  },
  gridItem: {
    width: '45%',              // ⬅️ 比 flexBasis 準確，讓兩格剛好並排
    marginBottom: 0,
  },
});

