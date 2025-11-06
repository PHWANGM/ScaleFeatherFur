// src/screens/LogsScreen.tsx
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import CustomCalendar from '../components/calendar/CustomCalendar';
import CalendarDateDetail from '../components/calendar/CalendarDateDetail';
import PetsHeader from '../components/headers/PetsHeader';

import { selectCurrentPetId, selectSelectedDate, setCurrentPetId, setSelectedDate } from '../state/slices/petsSlice';
import { query } from '../lib/db/db.client'; // ← 你專案的 db client 匯入路徑

type ActivitiesProps = {
  route?: { params?: { redirectToNewActivity?: boolean } };
  navigation: {
    setParams: (params: Record<string, unknown>) => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

function Activities({ route, navigation }: ActivitiesProps) {
  const dispatch = useDispatch();
  const isRedirect = route?.params?.redirectToNewActivity === true;

  const currentPetId = useSelector(selectCurrentPetId);
  const selectedDate = useSelector(selectSelectedDate);

  useFocusEffect(
    useCallback(() => {
      // 1) 確保 selectedDate（用本地現在）
      if (!selectedDate) {
        dispatch(setSelectedDate(new Date().toISOString()));
      }

      // 2) 確保 currentPetId（若還沒有，從 DB 撈第一筆）
      (async () => {
        try {
          if (!currentPetId) {
            const rows = await query<{ id: string }>(
              `SELECT id FROM pets ORDER BY created_at ASC LIMIT 1`,
              []
            );
            if (rows[0]?.id) {
              dispatch(setCurrentPetId(rows[0].id));
            }
          }
        } catch (e) {
          console.warn('[LogsScreen] bootstrap currentPetId failed:', e);
        }
      })();

      // 3) 原本的 redirect 流程
      if (isRedirect) {
        navigation.setParams({ redirectToNewActivity: false });
        navigation.navigate('Activities', { screen: 'NewActivity' });
      }
    }, [isRedirect, navigation, currentPetId, selectedDate, dispatch])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.activityContainer}>
        <PetsHeader />
        <View style={styles.calendar}>
          <CustomCalendar />
        </View>
        <View style={styles.date}>
          <CalendarDateDetail />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default Activities;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  activityContainer: { flex: 1, alignItems: 'center', width: '100%' },
  calendar: { flexShrink: 1, width: '100%' },
  date: { flex: 1, width: '100%' },
});
