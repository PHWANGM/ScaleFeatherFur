import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { theme } from '../styles/tokens';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../state/store';
import { loadLogsByPet, type CareLog } from '../state/slices/logsSlice';
import EmptyState from '../components/EmptyState';
import Card from '../components/cards/Card';
import { TASK_TYPES, type TaskType } from '../domain/taskTypes';

export default function LogsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const [petId, setPetId] = useState<string | null>(null);
  const [type, setType] = useState<TaskType | undefined>(undefined);
  const logs = useSelector((s: RootState) => (petId ? s.logs.byPet[petId] ?? [] : []));



  return (
    <View style={styles.container}>
      <Text style={styles.h1}>紀錄</Text>

      <View style={styles.filters}>
        <FlatList
          horizontal
          data={TASK_TYPES}
          keyExtractor={(k) => k}
          contentContainerStyle={{ gap: theme.spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setType(prev => (prev === item ? undefined : item))}
              style={[styles.chip, type === item && styles.chipActive]}
            >
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {!petId ? <EmptyState title="尚未選擇寵物" /> : (
        <FlatList
          contentContainerStyle={{ gap: theme.spacing.md }}
          data={logs}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.title}>{item.type}</Text>
              <Text style={styles.meta}>{new Date(item.at).toLocaleString()}</Text>
              {item.value != null && <Text style={styles.value}>Value: {item.value}</Text>}
              {item.note && <Text style={styles.meta}>{item.note}</Text>}
            </Card>
          )}
          ListEmptyComponent={<EmptyState title="沒有符合的紀錄" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.xl },
  h1: { ...theme.typography.h1, color: theme.colors.text, marginBottom: theme.spacing.md },
  filters: { marginBottom: theme.spacing.lg },
  chip: {
    paddingHorizontal: theme.spacing.md, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: { backgroundColor: theme.colors.primaryAlt + '22' },
  chipText: { color: theme.colors.text },
  title: { ...theme.typography.h3, color: theme.colors.text },
  meta: { ...theme.typography.small },
  value: { ...theme.typography.body, color: theme.colors.accent },
});
