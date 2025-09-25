// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Card from '../components/cards/Card';
import TaskCheckboxRow from '../components/TaskCheckboxRow';
import AlertSolutionCard from '../components/AlertSolutionCard';
import EmptyState from '../components/EmptyState';
import { theme } from '../styles/theme';
import { RootState, AppDispatch } from '../state/store';
import { loadPets } from '../state/slices/petsSlice';
import { addCareLog, loadLogsByPet } from '../state/slices/logsSlice';
import { addPointsForTask, getBalance } from '../state/slices/pointsSlice';
import { loadAlerts } from '../state/slices/alertsSlice';
import { type TaskType } from '../domain/taskTypes';

const TODAY_KEYS: { key: TaskType; title: string }[] = [
  { key: 'feed', title: '餵食' },
  { key: 'calcium', title: '加鈣' },
  { key: 'uvb_on', title: 'UVB 開' },
  { key: 'clean', title: '清潔' },
  { key: 'weigh', title: '量體重' },
];

// ✅ 用不可變的空陣列常數，避免每 render 新建 []
const EMPTY: ReadonlyArray<any> = Object.freeze([]);

export default function HomeScreen() {
  const dispatch = useDispatch<AppDispatch>();

  // 只選擇 "原始資料結構"（map/object），不要在 selector 內做 fallback
  const pets = useSelector((s: RootState) => s.pets.items);
  const alertsByPet = useSelector((s: RootState) => s.alerts.byPet);
  const pointsByPet = useSelector((s: RootState) => s.points.byPet);
  const logsByPet = useSelector((s: RootState) => s.logs.byPet);

  const [focusedPetId, setFocusedPetId] = useState<string | null>(null);

  useEffect(() => { dispatch(loadPets()); }, []);
  useEffect(() => {
    if (pets.length && !focusedPetId) setFocusedPetId(pets[0].id);
  }, [pets, focusedPetId]);

  useEffect(() => {
    if (!focusedPetId) return;
    dispatch(loadLogsByPet({ petId: focusedPetId }));
    dispatch(loadAlerts(focusedPetId));
    dispatch(getBalance(focusedPetId));
  }, [dispatch, focusedPetId]);

  const todayISO = new Date().toISOString().slice(0, 10);

  // 在組件中做 fallback，但用同一個 EMPTY 常數
  const logs = (focusedPetId && logsByPet[focusedPetId]) || EMPTY;
  const petAlerts = (focusedPetId && alertsByPet[focusedPetId]) || EMPTY;
  const balance = (focusedPetId && pointsByPet[focusedPetId]) || 0;

  const doneKeys = useMemo(() => {
    const set = new Set<TaskType>();
    (logs as any[]).forEach(l => {
      if ((l.at ?? '').startsWith(todayISO)) set.add(l.type as TaskType);
    });
    return set;
  }, [logs, todayISO]);

  const onToggleTask = async (taskKey: TaskType) => {
    if (!focusedPetId) return;
    if (!doneKeys.has(taskKey)) {
      const at = new Date().toISOString();
      await dispatch(addCareLog({ pet_id: focusedPetId, type: taskKey, value: null, note: null, at }));
      await dispatch(addPointsForTask({ petId: focusedPetId, taskKey, points: 5 }));
    }
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={[{ kind: 'tasks' }, { kind: 'alerts' }] as const}
      keyExtractor={(_, i) => String(i)}
      renderItem={({ item }) => {
        if (item.kind === 'tasks') {
          return (
            <Card style={{ marginBottom: theme.spacing.xl }}>
              <Text style={styles.h2}>今日任務</Text>
              <View style={{ height: theme.spacing.sm }} />
              {focusedPetId ? TODAY_KEYS.map(t => (
                <TaskCheckboxRow
                  key={t.key}
                  title={t.title}
                  description={t.key === 'uvb_on' ? '日照/UVB 曝光建議 10–20 分鐘（依品種與天氣）' : undefined}
                  checked={doneKeys.has(t.key)}
                  onToggle={() => onToggleTask(t.key)}
                />
              )) : <EmptyState title="尚未建立寵物" hint="請先新增寵物檔案" />}
              <View style={styles.balanceRow}>
                <Text style={styles.label}>CarePoints</Text>
                <Text style={styles.balance}>{balance}</Text>
              </View>
            </Card>
          );
        }
        // alerts
        return (
          <View>
            <Text style={styles.h2}>風險 / 解法</Text>
            <View style={{ height: theme.spacing.md }} />
            {petAlerts.length === 0
              ? <EmptyState title="目前沒有警報" hint="每日 09:00 自動檢查規則" />
              : (petAlerts as any[]).map(a => (
                  <View key={a.id} style={{ marginBottom: theme.spacing.lg }}>
                    <AlertSolutionCard
                      severity={a.severity}
                      title={a.title}
                      body={a.body}
                      products={tryDecodeProducts(a.recommended_product_ids)}
                      onOpenArticle={undefined}
                    />
                  </View>
                ))
            }
          </View>
        );
      }}
    />
  );
}

function tryDecodeProducts(s: string | null) {
  if (!s) return [];
  try {
    const ids: string[] = JSON.parse(s);
    return ids.slice(0, 2).map((id) => ({ id, name: `產品 ${id}`, affiliate_url: undefined }));
  } catch { return []; }
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.bg,
    gap: theme.spacing.xl,
  },
  h2: { ...theme.typography.h2, color: theme.colors.text },
  label: { ...theme.typography.small },
  balanceRow: {
    marginTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balance: { ...theme.typography.h2, color: theme.colors.accent },
});
