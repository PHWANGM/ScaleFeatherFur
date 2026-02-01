// src/lib/db/repos/sync.outbox.repo.ts
import { execute, query } from "../db.client"
import { nowIso } from "./_helpers"

export type OutboxType = "task_complete"

export type OutboxRow = {
  id: string
  type: OutboxType
  payload_json: string
  created_at: string
  synced_at: string | null
  tries: number
  last_error: string | null
}

// 用 deterministic id 來防重複排隊（同一天同任務同寵物）
export function makeTaskCompleteOutboxId(
  petId: string,
  day: string,
  taskKey: string,
) {
  return `task_complete:${petId}:${day}:${taskKey}`
}

export async function enqueueOutbox(
  id: string,
  type: OutboxType,
  payload: unknown,
): Promise<void> {
  const createdAt = nowIso()
  const payloadJson = JSON.stringify(payload)

  // INSERT OR IGNORE: 如果同 id 已經排過隊，就不再重複塞
  await execute(
    `INSERT OR IGNORE INTO sync_outbox (id, type, payload_json, created_at, synced_at, tries, last_error)
     VALUES (?, ?, ?, ?, NULL, 0, NULL)`,
    [id, type, payloadJson, createdAt],
  )
}

export function listUnsyncedOutbox(limit = 50): Promise<OutboxRow[]> {
  return query<OutboxRow>(
    `SELECT id, type, payload_json, created_at, synced_at, tries, last_error
     FROM sync_outbox
     WHERE synced_at IS NULL
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  )
}

export async function markOutboxSynced(id: string): Promise<void> {
  await execute(
    `UPDATE sync_outbox
     SET synced_at = ?, last_error = NULL
     WHERE id = ?`,
    [nowIso(), id],
  )
}

export async function markOutboxFailed(
  id: string,
  errorMsg: string,
): Promise<void> {
  await execute(
    `UPDATE sync_outbox
     SET tries = tries + 1, last_error = ?
     WHERE id = ?`,
    [errorMsg.slice(0, 500), id],
  )
}
