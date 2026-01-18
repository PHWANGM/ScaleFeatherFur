// src/lib/supabase/repos/tasks.repo.ts
//
// Supabase-backed Daily Tasks + Centralized Points (via RPC)
//
// Prereqs (DB):
// - public.tasks(key, title, description, points)
// - public.task_completion(user_id, pet_id, task_key, day, at, created_at)
// - RPC: public.complete_task(p_task_key text, p_pet_id text, p_day date) SECURITY DEFINER
// - RLS: task_completion select/insert own; points_ledger select own; points_ledger client insert revoked
//
// Client expectations:
// - You already have a configured Supabase client (supabase-js v2)
// - Care logs are still fetched from your existing local/Supabase care.logs repo
//
// Notes:
// - We treat "day" as a local-calendar date (device local). For Taiwan, your device is Asia/Taipei.
// - We keep the same public API shape: listTasks / getDailyTaskStatus / completeTaskManually
// - Points are awarded ONLY in DB via RPC (client never inserts points_ledger).

import type { SupabaseClient } from '@supabase/supabase-js';
import { listCareLogsByPetBetween, type CareLogRow } from '../../db/repos/care.logs';

// =====================
// Types
// =====================
export type TaskRow = {
  key: string;
  title: string;
  description: string | null;
  points: number;
};

export type TaskCompletionRow = {
  id: string;
  user_id: string;
  pet_id: string | null;
  task_key: string;
  day: string; // YYYY-MM-DD (date)
  at: string; // timestamptz (ISO)
  created_at: string;
};

export type TaskStatus = TaskRow & {
  completed: boolean;
  auto: boolean;
};

// =====================
// Auto task mapping
// =====================
const AUTO_TASK_KEYS = new Set([
  'feed',
  'calcium',
  'vitamin',
  'uvb',
  'heat',
  'clean',
  'weigh',
]);

const isAutoTask = (key: string) => AUTO_TASK_KEYS.has(key);

// =====================
// Date helpers
// =====================

/**
 * Returns [startISO, endISO] for the local-day range of the given Date.
 * (Same behavior as your old code: local midnight -> next local midnight, then toISOString)
 */
export function dayRangeIsoLocal(date: Date): [string, string] {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const startLocal = new Date(y, m, d, 0, 0, 0, 0);
  const endLocal = new Date(y, m, d + 1, 0, 0, 0, 0);
  return [startLocal.toISOString(), endLocal.toISOString()];
}
export async function getUserPointsTotal(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('get_points_total');
  if (error) throw new Error(`get_points_total RPC failed: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Convert an ISO string to a local calendar date string YYYY-MM-DD.
 * Important: uses device local timezone. For your Taiwan users, that's Asia/Taipei.
 */
function isoToLocalDayString(iso: string): string {
  const dt = new Date(iso);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// =====================
// Core DB calls
// =====================

export async function listTasks(supabase: SupabaseClient): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('key,title,description,points')
    .order('key', { ascending: true });

  if (error) throw new Error(`listTasks failed: ${error.message}`);
  return (data ?? []) as TaskRow[];
}

async function listTaskCompletionsByPetAndDay(
  supabase: SupabaseClient,
  petId: string,
  day: string
): Promise<TaskCompletionRow[]> {
  const { data, error } = await supabase
    .from('task_completion')
    .select('id,user_id,pet_id,task_key,day,at,created_at')
    .eq('day', day)
    // If you decided pet_id is nullable and you want "per user per day per task" uniqueness,
    // we still filter by pet_id for UI status for this pet.
    .eq('pet_id', petId);

  if (error) throw new Error(`listTaskCompletionsByPetAndDay failed: ${error.message}`);
  return (data ?? []) as TaskCompletionRow[];
}

/**
 * Call DB RPC to:
 *  - insert task_completion (idempotent by unique constraint)
 *  - insert points_ledger (only if completion inserted)
 */
async function rpcCompleteTask(
  supabase: SupabaseClient,
  petId: string,
  taskKey: string,
  day: string
): Promise<void> {
  const { error } = await supabase.rpc('complete_task', {
    p_task_key: taskKey,
    p_pet_id: petId,
    p_day: day, // YYYY-MM-DD
  });

  if (error) throw new Error(`complete_task RPC failed (${taskKey}): ${error.message}`);
}

// =====================
// Auto-done detection (same logic as your old repo)
// =====================
function isTaskDoneByLogs(taskKey: string, logs: CareLogRow[]): boolean {
  switch (taskKey) {
    case 'feed':
      return logs.some((l) => l.type === 'feed');
    case 'calcium':
      return logs.some((l) => l.type === 'calcium');
    case 'vitamin':
      return logs.some((l) => l.type === 'vitamin');
    case 'uvb':
      return logs.some((l) => l.type === 'uvb' || l.type === 'uvb_on' || l.type === 'uvb_off');
    case 'heat':
      return logs.some((l) => l.type === 'heat_on' || l.type === 'heat_off');
    case 'clean':
      return logs.some((l) => l.type === 'clean');
    case 'weigh':
      return logs.some((l) => l.type === 'weigh');
    default:
      return false;
  }
}

// =====================
// Public API
// =====================

/**
 * Returns task list with completed/auto flags for the given pet and day range.
 * - Reads tasks from Supabase
 * - Reads care logs (your existing repo)
 * - Reads completion rows from Supabase
 * - Auto-completes tasks by logs via RPC (idempotent), then returns final status.
 */
export async function getDailyTaskStatus(
  supabase: SupabaseClient,
  petId: string,
  dayStartISO: string,
  dayEndISO: string
): Promise<TaskStatus[]> {
  const day = isoToLocalDayString(dayStartISO);

  // 1) Load all data needed
  const [tasks, logs, completions] = await Promise.all([
    listTasks(supabase),
    listCareLogsByPetBetween(petId, dayStartISO, dayEndISO),
    listTaskCompletionsByPetAndDay(supabase, petId, day),
  ]);

  const completedSet = new Set(completions.map((c) => c.task_key));

  // 2) Auto-complete (by logs) via RPC (safe to call multiple times thanks to unique constraint)
  // Do it sequentially to keep requests sane; you can batch if you want later.
  for (const task of tasks) {
    if (!isAutoTask(task.key)) continue;
    if (completedSet.has(task.key)) continue;
    if (!isTaskDoneByLogs(task.key, logs)) continue;

    await rpcCompleteTask(supabase, petId, task.key, day);
    completedSet.add(task.key);
  }

  // 3) Return status
  return tasks.map((t) => ({
    ...t,
    completed: completedSet.has(t.key),
    auto: isAutoTask(t.key),
  }));
}

/**
 * Manual completion (award points via RPC).
 *
 * Signature keeps your old "points" parameter for compatibility,
 * but points are actually determined in DB from public.tasks.points.
 */
export async function completeTaskManually(
  supabase: SupabaseClient,
  petId: string,
  taskKey: string,
  dayStartISO: string,
  _dayEndISO: string,
  _points: number
): Promise<void> {
  const day = isoToLocalDayString(dayStartISO);
  await rpcCompleteTask(supabase, petId, taskKey, day);
}
