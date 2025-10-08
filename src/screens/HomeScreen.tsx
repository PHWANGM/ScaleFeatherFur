import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Alert,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/rootNavigator';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

const PRIMARY = '#38e07b';

export default function HomeScreen({ navigation }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = useMemo(
    () => ({
      bg: isDark ? '#122017' : '#f6f8f7',
      card: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
      text: isDark ? '#ffffff' : '#1f2937',
      subText: isDark ? '#d1d5db' : '#4b5563',
      border: 'rgba(56,224,123,0.3)',
    }),
    [isDark]
  );

  const [tasks, setTasks] = useState([
    { key: 'temp', label: 'Check enclosure temperature', done: true },
    { key: 'mist', label: 'Mist enclosure', done: true },
    { key: 'observe', label: 'Observe for any health changes', done: false },
  ]);

  const toggleTask = (k: string) =>
    setTasks((arr) => arr.map((t) => (t.key === k ? { ...t, done: !t.done } : t)));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View style={{ width: 48 }} />
        <Text style={[styles.appTitle, { color: colors.text }]}>ScaleFeatherFur</Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => Alert.alert('Settings', 'Open settings…')}
          hitSlop={10}
        >
          <Feather name="settings" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pet header */}
        <View style={styles.petRow}>
          <Image
            source={{
              uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUOIGdn2TnKmCo9kPudx1UkTcpugunLBRhgyleUPOTX4qYSTwA4WnK-kzqlAqB6syHzDu0vfaPXRbIcEmD_zQQIf6TQ2sf3i9FN_I0o7qzIIpdSNzBOwBkUByOLeqCH_Ezh12HjbFbXadx0Pm9ASWqFlQNUXmc3YvobOFoLxWvRWgtCzE_e5qCtCIdU3bl0QQWEgjP5N31PwAgtpEAdqV7IdjhL44rhvX8b8UGUxhSd8xFUP8DZXuYZAmZncor4uSJR0Mg-iWBFic',
            }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.petName, { color: colors.text }]}>Rex</Text>
            <Text style={[styles.petMeta, { color: colors.subText }]}>Chameleon</Text>
            <Text style={[styles.petMeta, { color: colors.subText }]}>Age: 2 years</Text>
          </View>
        </View>

        {/* Care Alerts */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Care Alerts</Text>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.alertRow}>
              <View style={styles.alertIconBox}>
                <Feather name="cloud" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.text }]}>Feeding</Text>
                <Text style={[styles.alertSub, { color: colors.subText }]}>
                  Next feeding in 2 days
                </Text>
              </View>
            </View>

            <View style={[styles.alertRow, { marginTop: 10 }]}>
              <View style={styles.alertIconBox}>
                <MaterialCommunityIcons name="stethoscope" size={22} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertTitle, { color: colors.text }]}>Vet Checkup</Text>
                <Text style={[styles.alertSub, { color: colors.subText }]}>
                  Next vet visit in 1 month
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Daily Tasks */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Tasks</Text>
          <View style={[styles.card, { backgroundColor: colors.card, paddingVertical: 6 }]}>
            {tasks.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => toggleTask(t.key)}
                style={({ pressed }) => [styles.taskRow, pressed && { opacity: 0.7 }]}
              >
                <Checkbox
                  value={t.done}
                  onValueChange={() => toggleTask(t.key)}
                  color={t.done ? PRIMARY : undefined}
                  style={styles.checkbox}
                />
                <Text style={[styles.taskLabel, { color: colors.text }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Resources */}
        <View style={{ marginTop: 16, marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Resources</Text>
          <Pressable
            style={({ pressed }) => [
              styles.resourceRow,
              { backgroundColor: colors.card },
              pressed && { opacity: 0.7 },
            ]}
            // 以前導到 'Articles'，現在改到你的分頁之一（示範導到 Community）
            onPress={() => navigation.navigate('Community')}
          >
            <View style={styles.resourceIconBox}>
              <Feather name="book-open" size={20} color={PRIMARY} />
            </View>
            <Text style={[styles.resourceLabel, { color: colors.text }]}>
              Chameleon Care Guide
            </Text>
            <Feather name="chevron-right" size={18} color={colors.subText} />
          </Pressable>
        </View>

        {/* 你也可以提供一個快速新增入口（會前往中間的 Plus 分頁＝PetEditorScreen） */}
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: PRIMARY, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => navigation.navigate('Plus')}
        >
          <Feather name="plus" size={20} color="#122017" />
          <Text style={styles.addButtonText}>Add Care / Log</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginRight: 16 },
  petName: { fontSize: 24, fontWeight: '800' },
  petMeta: { fontSize: 14, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  card: { borderRadius: 12, padding: 12 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(56,224,123,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 16, fontWeight: '600' },
  alertSub: { fontSize: 12, marginTop: 2 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  checkbox: { width: 22, height: 22, borderRadius: 4, marginRight: 10 },
  taskLabel: { fontSize: 15 },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  resourceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(56,224,123,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  addButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#122017',
  },
});
