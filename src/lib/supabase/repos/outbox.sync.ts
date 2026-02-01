// src/lib/supabase/repos/outbox.sync.ts
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listUnsyncedOutbox,
  markOutboxFailed,
  markOutboxSynced,
} from "../../db/repos/sync.outbox.repo"

// 你 supabase tasks repo 內部的 RPC 函式目前是 private，這裡直接 rpc 呼叫即可
async function rpcCompleteTask(
  supabase: SupabaseClient,
  petId: string,
  taskKey: string,
  day: string,
): Promise<void> {
  const { error } = await supabase.rpc("complete_task", {
    p_task_key: taskKey,
    p_pet_id: petId,
    p_day: day, // YYYY-MM-DD
  })
  if (error) throw new Error(error.message)
}

export async function flushOutboxToSupabase(
  supabase: SupabaseClient,
  limit = 50,
): Promise<{ ok: number; failed: number }> {
  const rows = await listUnsyncedOutbox(limit)
  let ok = 0
  let failed = 0

  for (const row of rows) {
    try {
      if (row.type === "task_complete") {
        const payload = JSON.parse(row.payload_json) as {
          petId: string
          taskKey: string
          day: string
        }
        await rpcCompleteTask(
          supabase,
          payload.petId,
          payload.taskKey,
          payload.day,
        )
        await markOutboxSynced(row.id)
        ok += 1
      } else {
        // 未知事件：標記失敗，避免無限卡住
        await markOutboxFailed(row.id, `Unknown outbox type: ${row.type}`)
        failed += 1
      }
    } catch (e: any) {
      await markOutboxFailed(row.id, String(e?.message ?? e))
      failed += 1
    }
  }

  return { ok, failed }
}
