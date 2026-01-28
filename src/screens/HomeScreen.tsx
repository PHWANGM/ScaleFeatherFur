// src/screens/HomeScreen.tsx
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/rootNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import PetsHeader from '../components/headers/PetsHeader';
import { setCurrentPetId, selectCurrentPetId } from '../state/slices/petsSlice';
import {
  getPetWithSpeciesById,
  listPetsWithSpecies,
  type PetWithSpeciesRow,
} from '../lib/db/repos/pets.repo';
import { useThemeColors } from '../styles/themesColors';

// hooks
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useNext24HourlyWeatherByCoords } from '../hooks/useNext24HourlyWeatherByCoords';

// components
import EnvironmentSection from '../components/charts/EnvironmentSection';
import DailyTasksModal from '../components/modals/DailyTasksModal';

// ✅ NEW: CareAlerts section (extracted)
import CareAlerts from '../components/warning/CareAlerts';

// ✅ NEW: WeightTrend section (extracted)
import WeightTrend from '../components/WeightTrend';

// ✅ Local (offline) tasks repo
import * as DbTasks from '../lib/db/repos/tasks.repo';
import type { TaskStatus } from '../lib/db/repos/tasks.repo';

// ✅ Supabase client + supabase tasks repo
import { supabase } from '../lib/supabase';
import * as SbTasks from '../lib/supabase/repos/tasks.repo';

// ✅ Outbox flush + pending
import { flushOutboxToSupabase } from '../lib/supabase/repos/outbox.sync';
import { listUnsyncedOutbox } from '../lib/db/repos/sync.outbox.repo';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

type SyncState =
  | { status: 'idle' }
  | { status: 'syncing' }
  | { status: 'ok'; ok: number; failed: number }
  | { status: 'error'; message: string };

/**
 * ✅ 每次「App 打開 / 從背景回前景」才會 +1
 * 用它來保證：同一個 session 不重抓天氣
 */
function useAppActiveSessionId() {
  const [sessionId, setSessionId] = useState(1);

  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (next) => {
      const wasBg = prev === 'background' || prev === 'inactive';
      const isActive = next === 'active';
      prev = next;

      if (wasBg && isActive) setSessionId((s) => s + 1);
    });

    return () => sub.remove();
  }, []);

  return sessionId;
}

export default function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const dispatch = useDispatch();
  const currentPetId = useSelector(selectCurrentPetId);
  const { colors, isDark } = useThemeColors();

  const palette = useMemo(
    () => ({
      bg: colors.bg,
      card: colors.card,
      text: colors.text,
      subText: colors.subText ?? (colors as any).textDim ?? '#97A3B6',
      border: colors.border,
      primary: colors.primary ?? '#38e07b',
    }),
    [colors]
  );

  // ✅ sessionId：每次開 App / 回前景 +1（同一 session 不重抓天氣）
  const sessionId = useAppActiveSessionId();

  // 🐾 Pet state
  const [pet, setPet] = useState<PetWithSpeciesRow | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Daily tasks state
  const [tasksOpen, setTasksOpen] = useState(false);
  const [dailyTasks, setDailyTasks] = useState<TaskStatus[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // ✅ Sync UI state
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });

  // 📍 Location（你原本的 hook，不用改）
  const { coords, locationName, loading: locationLoading } = useCurrentLocation();

  // 🌤 Weather（✅ 傳 sessionId 進去）
  const {
    loading: weatherLoading,
    tempRisk,
    uvbRisk,
    next24Temp,
    uviHourly,
    currentCloud,
  } = useNext24HourlyWeatherByCoords(coords, currentPetId, {
    maxAgeHours: 2,
    sessionId,
  });

  /** 🦎 讀取寵物資料 */
  const loadPet = useCallback(async () => {
    setLoading(true);
    try {
      if (currentPetId) {
        const row = await getPetWithSpeciesById(currentPetId);
        setPet(row);
      } else {
        const rows = await listPetsWithSpecies({ limit: 1 });
        if (rows.length > 0) {
          dispatch(setCurrentPetId(rows[0].id));
          setPet(rows[0]);
        } else {
          setPet(null);
        }
      }
    } catch (e: any) {
      Alert.alert(t('home.dbErrorTitle'), String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [currentPetId, dispatch, t]);

  useFocusEffect(
    useCallback(() => {
      loadPet();
    }, [loadPet])
  );

  // =========================
  // ✅ Outbox flush helper (also updates pendingCount + syncState)
  // =========================
  const syncNow = useCallback(async () => {
    try {
      setSyncState({ status: 'syncing' });

      const pendingBefore = await listUnsyncedOutbox(999);
      setPendingCount(pendingBefore.length);

      const r = await flushOutboxToSupabase(supabase);
      console.log('[flushOutboxToSupabase] result', r);

      const pendingAfter = await listUnsyncedOutbox(999);
      setPendingCount(pendingAfter.length);

      setSyncState({ status: 'ok', ok: r.ok, failed: r.failed });
      return r;
    } catch (e: any) {
      console.log('[flushOutboxToSupabase] failed', e);
      setSyncState({ status: 'error', message: e?.message ?? String(e) });

      // still update pending
      try {
        const pending = await listUnsyncedOutbox(999);
        setPendingCount(pending.length);
      } catch {}
      return { ok: 0, failed: 0 };
    }
  }, []);

  // =========================
  // ✅ Refresh daily tasks:
  //    1) flush outbox
  //    2) try supabase tasks
  //    3) fallback local db tasks
  // =========================
  const refreshDailyTasks = useCallback(async () => {
    if (!currentPetId) {
      setDailyTasks([]);
      return;
    }

    setTasksLoading(true);
    try {
      const [dayStartISO, dayEndISO] = DbTasks.dayRangeIsoLocal(new Date());

      // 1) sync outbox (best effort)
      await syncNow();

      // 2) primary: Supabase
      try {
        const rows = await SbTasks.getDailyTaskStatus(
          supabase,
          currentPetId,
          dayStartISO,
          dayEndISO
        );
        setDailyTasks(rows as TaskStatus[]);
        return;
      } catch (e: any) {
        console.warn('[HomeScreen] supabase daily tasks failed, fallback local:', e);
      }

      // 3) fallback: Local DB
      const localRows = await DbTasks.getDailyTaskStatus(currentPetId, dayStartISO, dayEndISO);
      setDailyTasks(localRows);
    } catch (e: any) {
      console.warn('[HomeScreen] refreshDailyTasks failed:', e);
      setDailyTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [currentPetId, syncNow]);

  useFocusEffect(
    useCallback(() => {
      refreshDailyTasks();
    }, [refreshDailyTasks])
  );

  // ✅ Manual toggle: offline-first (local DB), then refresh (will sync + load)
  const handleManualToggle = useCallback(
    async (task: TaskStatus) => {
      if (!currentPetId || task.completed || task.auto) return;

      try {
        const [dayStartISO, dayEndISO] = DbTasks.dayRangeIsoLocal(new Date());

        // 1) local complete (should enqueue outbox inside db/tasks.repo.ts)
        await DbTasks.completeTaskManually(
          currentPetId,
          task.key,
          dayStartISO,
          dayEndISO,
          task.points
        );

        // 2) refresh (sync + load)
        await refreshDailyTasks();
      } catch (e: any) {
        console.warn('[HomeScreen] handleManualToggle failed:', e);
      }
    },
    [currentPetId, refreshDailyTasks]
  );

  const speciesLabel = pet?.species_name ?? pet?.species_key ?? t('common.none');
  const environmentLoading = locationLoading || weatherLoading;
  const completedCount = dailyTasks.filter((tt) => tt.completed).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={['top', 'left', 'right']}
    >
      {/* 🧭 Header */}
      <View style={[styles.header, { backgroundColor: palette.bg }]}>
        <View style={{ width: 48 }} />
        <Text style={[styles.appTitle, { color: palette.text }]}>ScaleFeatherFur</Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => Alert.alert(t('settings.title'), t('home.openSettings'))}
          hitSlop={10}
        >
          <Feather name="settings" size={22} color={isDark ? '#d1d5db' : '#4b5563'} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: palette.subText }}>{t('home.loadingFromDatabase')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PetsHeader />

          {/* ✅ Care Alerts (extracted) */}
          <CareAlerts
            palette={{
              card: palette.card,
              border: palette.border,
              text: palette.text,
              subText: palette.subText,
              primary: palette.primary,
            }}
            speciesLabel={speciesLabel}
            currentPetId={currentPetId}
            tempRisk={tempRisk}
            uvbRisk={uvbRisk}
          />

          {/* 🌤 Environment */}
          <View style={{ marginTop: 16 }}>
            <EnvironmentSection
              locationName={locationName}
              loading={environmentLoading}
              tempHourly={next24Temp}
              uviHourly={uviHourly}
              currentCloud={currentCloud}
              tempRisk={tempRisk}
              uvbRisk={uvbRisk}
            />
          </View>

          {/* ✅ Weight Trend (extracted) */}
          <WeightTrend
            palette={{
              card: palette.card,
              border: palette.border,
              text: palette.text,
            }}
          />

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ✅ Open daily tasks: open modal, then sync+refresh */}
      <Pressable
        style={[styles.taskFab, { backgroundColor: palette.primary }]}
        onPress={async () => {
          setTasksOpen(true);
          await refreshDailyTasks();
        }}
      >
        <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#022c22" />
      </Pressable>

      <DailyTasksModal
        visible={tasksOpen}
        onClose={() => setTasksOpen(false)}
        palette={{
          card: palette.card,
          border: palette.border,
          text: palette.text,
          subText: palette.subText,
        }}
        tasksLoading={tasksLoading}
        tasks={dailyTasks}
        completedCount={completedCount}
        onToggleTask={handleManualToggle}
        pendingCount={pendingCount}
        syncState={
          syncState.status === 'ok'
            ? { status: 'ok', ok: syncState.ok, failed: syncState.failed }
            : syncState.status === 'error'
              ? { status: 'error', message: syncState.message }
              : syncState.status === 'syncing'
                ? { status: 'syncing' }
                : { status: 'idle' }
        }
        onPressSync={() => {
          refreshDailyTasks();
        }}
      />
    </SafeAreaView>
  );
}

/* 🧱 Styles */
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
  taskFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
