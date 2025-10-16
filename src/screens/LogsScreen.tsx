// src/screens/LogsScreen.tsx
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CustomCalendar from '../components/calendar/CustomCalendar';
import CalendarDateDetail from '../components/calendar/CalendarDateDetail';
import PetsHeader from '../components/headers/PetsHeader';

type ActivitiesProps = {
  route?: { params?: { redirectToNewActivity?: boolean } };
  navigation: {
    setParams: (params: Record<string, unknown>) => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
};

function Activities({ route, navigation }: ActivitiesProps) {
  const isRedirect = route?.params?.redirectToNewActivity === true;

  useFocusEffect(
    useCallback(() => {
      if (isRedirect) {
        navigation.setParams({ redirectToNewActivity: false });
        navigation.navigate('Activities', { screen: 'NewActivity' });
      }
      // 沒有清理邏輯需求就回傳 undefined
    }, [isRedirect, navigation])
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  activityContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  calendar: {
    flexShrink: 1,
    width: '100%',
  },
  date: {
    flex: 1,
    width: '100%',
  },
});
