// src/lib/db/repos/tasks.repo.ts
import { execute, query, type SQLParams } from "../db.client"
import { genId, nowIso } from "./_helpers"
import { type CareLogRow, listCareLogsByPetBetween } from "./care.logs"
import { enqueueOutbox, makeTaskCompleteOutboxId } from "./sync.outbox.repo"

export type TaskRow = {
  key: string
  title: string
  description: string | null
  points: number
}

export type TaskCompletionRow = {
  id: string
  pet_id: string
  task_key: string
  at: string
  created_at: string
  updated_at: string
}

export type TaskStatus = TaskRow & {
  completed: boolean
  auto: boolean
}

const AUTO_TASK_KEYS = new Set([
  "feed",
  "calcium",
  "vitamin",
  "uvb",
  "heat",
  "clean",
  "weigh",
])

const isAutoTask = (key: string) => AUTO_TASK_KEYS.has(key)

function isoToLocalDayString(iso: string): string {
  const dt = new Date(iso)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

async function enqueueTaskComplete(
  petId: string,
  taskKey: string,
  dayStartISO: string,
) {
  const day = isoToLocalDayString(dayStartISO)
  const id = makeTaskCompleteOutboxId(petId, day, taskKey)
  await enqueueOutbox(id, "task_complete", { petId, taskKey, day })
}

export function dayRangeIsoLocal(date: Date): [string, string] {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  const startLocal = new Date(y, m, d, 0, 0, 0, 0)
  const endLocal = new Date(y, m, d + 1, 0, 0, 0, 0)
  return [startLocal.toISOString(), endLocal.toISOString()]
}

export async function listTasks(): Promise<TaskRow[]> {
  return query<TaskRow>(
    `SELECT key, title, description, points FROM tasks ORDER BY key ASC`,
  )
}

async function listTaskCompletionsByPetBetween(
  petId: string,
  dayStartISO: string,
  dayEndISO: string,
): Promise<TaskCompletionRow[]> {
  return query<TaskCompletionRow>(
    `SELECT * FROM task_completion WHERE pet_id=? AND at >= ? AND at < ?`,
    [petId, dayStartISO, dayEndISO],
  )
}

async function insertTaskCompletion(
  petId: string,
  taskKey: string,
  atIso: string,
): Promise<void> {
  const now = nowIso()
  const id = genId("taskc")
  await execute(
    `INSERT INTO task_completion (id, pet_id, task_key, at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, petId, taskKey, atIso, now, now],
  )
}

async function hasPointsForTaskDay(
  petId: string,
  taskKey: string,
  dayStartISO: string,
  dayEndISO: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM points_ledger WHERE pet_id=? AND reason=? AND at >= ? AND at < ? LIMIT 1`,
    [petId, `task_complete:${taskKey}`, dayStartISO, dayEndISO],
  )
  return rows.length > 0
}

async function insertPointsForTask(
  petId: string,
  taskKey: string,
  points: number,
): Promise<void> {
  const last = await query<{ balance_after: number }>(
    `SELECT balance_after FROM points_ledger WHERE pet_id=? ORDER BY at DESC LIMIT 1`,
    [petId],
  )
  const prev = last[0]?.balance_after ?? 0
  const now = nowIso()
  const id = genId("pt")
  const balance = prev + points

  await execute(
    `INSERT INTO points_ledger (id, pet_id, at, reason, delta, balance_after, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, petId, now, `task_complete:${taskKey}`, points, balance, now, now],
  )
}

function isTaskDoneByLogs(taskKey: string, logs: CareLogRow[]): boolean {
  switch (taskKey) {
    case "feed":
      return logs.some((l) => l.type === "feed")
    case "calcium":
      return logs.some((l) => l.type === "calcium")
    case "vitamin":
      return logs.some((l) => l.type === "vitamin")
    case "uvb":
      return logs.some((l) =>
        l.type === "uvb" || l.type === "uvb_on" || l.type === "uvb_off"
      )
    case "heat":
      return logs.some((l) => l.type === "heat_on" || l.type === "heat_off")
    case "clean":
      return logs.some((l) => l.type === "clean")
    case "weigh":
      return logs.some((l) => l.type === "weigh")
    default:
      return false
  }
}

export async function getDailyTaskStatus(
  petId: string,
  dayStartISO: string,
  dayEndISO: string,
): Promise<TaskStatus[]> {
  const [tasks, logs, completions] = await Promise.all([
    listTasks(),
    listCareLogsByPetBetween(petId, dayStartISO, dayEndISO),
    listTaskCompletionsByPetBetween(petId, dayStartISO, dayEndISO),
  ])

  const completedSet = new Set(completions.map((c) => c.task_key))

  for (const task of tasks) {
    if (!isAutoTask(task.key)) continue
    if (completedSet.has(task.key)) continue
    if (!isTaskDoneByLogs(task.key, logs)) continue

    await insertTaskCompletion(petId, task.key, dayStartISO)
    if (!(await hasPointsForTaskDay(petId, task.key, dayStartISO, dayEndISO))) {
      await insertPointsForTask(petId, task.key, task.points)
    }
    await enqueueTaskComplete(petId, task.key, dayStartISO) // ✅ 新增：排隊同步

    completedSet.add(task.key)
  }

  return tasks.map((t) => ({
    ...t,
    completed: completedSet.has(t.key),
    auto: isAutoTask(t.key),
  }))
}

export async function completeTaskManually(
  petId: string,
  taskKey: string,
  dayStartISO: string,
  dayEndISO: string,
  points: number,
): Promise<void> {
  const existing = await listTaskCompletionsByPetBetween(
    petId,
    dayStartISO,
    dayEndISO,
  )
  if (existing.some((c) => c.task_key === taskKey)) return

  await insertTaskCompletion(petId, taskKey, nowIso())
  if (!(await hasPointsForTaskDay(petId, taskKey, dayStartISO, dayEndISO))) {
    await insertPointsForTask(petId, taskKey, points)
  }
  await enqueueTaskComplete(petId, taskKey, dayStartISO)
}
// ===== Points totals (Local SQLite) =====

/**
 * Get total points for a single pet.
 * We use MAX(balance_after) because you maintain balance_after as a running balance.
 */
export async function getTotalPointsByPet(petId: string): Promise<number> {
  const rows = await query<{ total: number }>(
    `SELECT COALESCE(MAX(balance_after), 0) AS total
     FROM points_ledger
     WHERE pet_id = ?`,
    [petId],
  )
  return Number(rows[0]?.total ?? 0)
}

/**
 * Get total points across ALL pets (local/offline).
 *
 * If you want "sum of each pet's latest balance", we do:
 *   sum( max(balance_after) per pet_id )
 */
export async function getTotalPointsAllPets(): Promise<number> {
  const rows = await query<{ total: number }>(
    `SELECT COALESCE(SUM(last_balance), 0) AS total
     FROM (
       SELECT pet_id, MAX(balance_after) AS last_balance
       FROM points_ledger
       GROUP BY pet_id
     )`,
    [],
  )
  return Number(rows[0]?.total ?? 0)
}
