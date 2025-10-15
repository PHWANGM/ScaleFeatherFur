import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
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

const Activities: React.FC<ActivitiesProps> = ({ route, navigation }) => {
  const isFocused = useIsFocused();
  const isRedirect = route?.params?.redirectToNewActivity === true;

  useEffect(() => {
    if (!isFocused) return;
    if (isRedirect) {
      navigation.setParams({ redirectToNewActivity: false });
      navigation.navigate('Activities', { screen: 'NewActivity' });
    }
  }, [isFocused, isRedirect, navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.activityContainer}>
        {/* ✅ 共用 PetsHeader（與 Home 一致） */}
        <PetsHeader/>

        <View style={styles.calendar}>
          <CustomCalendar />
        </View>
        <View style={styles.date}>
          <CalendarDateDetail />
        </View>
      </View>
    </SafeAreaView>
  );
};

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
