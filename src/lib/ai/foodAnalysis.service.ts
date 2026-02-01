// src/lib/ai/foodAnalysis.supabase.ts
import { supabase } from "../supabase" // TODO: 改成你專案實際 supabase client 路徑
import * as Crypto from "expo-crypto"
import * as FileSystem from "expo-file-system/legacy"

export type FoodType = "vegetables" | "meat" | "fruit" | "mixed" | "unknown"

export type FoodAnalysisResult = {
  foodType: FoodType
  estimatedWeightGrams: number
  identifiedItems: string[]
  confidence: number // 0~1
  notes?: string
}

export type FoodAnalysisError = {
  code:
    | "NOT_AUTHENTICATED"
    | "UPLOAD_FAILED"
    | "JOB_CREATE_FAILED"
    | "FUNCTION_FAILED"
    | "RESULT_FETCH_FAILED"
    | "TIMEOUT"
    | "UNKNOWN"
  message: string
  details?: string
}

function makeError(
  code: FoodAnalysisError["code"],
  message: string,
  details?: string,
): FoodAnalysisError {
  return { code, message, details }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * base64 -> Uint8Array
 * 注意：Expo/RN 通常有 globalThis.atob；若你遇到 atob is not defined 再跟我說，我給你 Buffer 版。
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * expo-image-picker 的 file:// uri
 * 用 expo-file-system/legacy 讀成 base64，再轉 Uint8Array
 */
async function uriToUint8Array(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: "base64" as unknown as FileSystem.EncodingType,
  })
  if (!base64) throw new Error("readAsStringAsync returned empty base64")
  return base64ToUint8Array(base64)
}

type InvokeErrLike = {
  message?: string
  context?: { status?: number; response?: Response }
}

/**
 * 從 FunctionsHttpError 抽出 status/body（RN 常拿不到 body，拿得到就印出來）
 */
async function _readInvokeErrorDetail(err: unknown): Promise<{
  status?: number
  bodyText?: string
  message: string
}> {
  const e = err as InvokeErrLike
  const status = e?.context?.status

  let bodyText: string | undefined
  try {
    bodyText = await e?.context?.response?.text()
  } catch {
    bodyText = undefined
  }

  return {
    status,
    bodyText,
    message: String(e?.message ?? err),
  }
}

/* =========================
   ✅ 方案一：用 raw fetch 直接打 Functions，拿到真實 body
   ========================= */

type RawFnOk = { ok: true; job_id?: string } | { ok: boolean; job_id?: string }
type RawFnErr =
  | { code?: number; message?: string; error?: string }
  | Record<string, unknown>

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function stringifyUnknown(x: unknown): string {
  if (typeof x === "string") return x
  try {
    return JSON.stringify(x)
  } catch {
    return String(x)
  }
}

async function invokeAiAnalyzeRaw(jobId: string): Promise<RawFnOk> {
  const process =
    (globalThis as { process?: { env: Record<string, string | undefined> } })
      .process as {
        env: Record<string, string | undefined>
      }
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL")
  if (!anonKey) throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY")

  const { data: sessionData, error: sessErr } = await supabase.auth.getSession()
  if (sessErr) throw new Error(sessErr.message)

  const token = sessionData.session?.access_token
  if (!token) throw new Error("Missing access_token")

  const url = `${supabaseUrl}/functions/v1/ai-analyze`

  // ⚠️ 這裡「只」靠 fetch，完全不走 supabase.functions.invoke()
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ job_id: jobId }),
  })

  const text = await resp.text()

  console.log("[ai-analyze raw] status =", resp.status)
  console.log("[ai-analyze raw] body =", text)

  if (!resp.ok) {
    // 盡量把錯誤格式化得好讀
    const parsed = safeJsonParse(text) as RawFnErr | null
    const msg = parsed && typeof parsed === "object"
      ? `ai-analyze failed: ${resp.status} ${stringifyUnknown(parsed)}`
      : `ai-analyze failed: ${resp.status} ${text}`
    throw new Error(msg)
  }

  const parsed = safeJsonParse(text)
  if (parsed && typeof parsed === "object") {
    return parsed as RawFnOk
  }

  // 若回來不是 JSON（理論上不會），也算成功
  return { ok: true, job_id: jobId }
}

/**
 * 上傳圖片 → 建 ai_jobs（image_path NOT NULL）→ (raw fetch) 呼叫 edge function → poll ai_results
 */
export async function analyzeFoodViaSupabase(
  imageUri: string,
  opts?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<{ jobId: string; result: FoodAnalysisResult }> {
  const timeoutMs = opts?.timeoutMs ?? 45_000
  const pollIntervalMs = opts?.pollIntervalMs ?? 800

  // 0) 必須登入 + 拿 uid/token
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const uid = userData?.user?.id

  if (userErr || !uid) {
    throw makeError("NOT_AUTHENTICATED", "尚未登入", userErr?.message)
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  console.log("[analyzeFoodViaSupabase] token exists?", !!token)
  if (!token) {
    throw makeError("NOT_AUTHENTICATED", "尚未登入（session/token 不存在）")
  }

  // 1) jobId
  const jobId = Crypto.randomUUID()

  // 2) upload
  const bucket = "ai-images"
  const path = `${uid}/${jobId}.jpg`

  try {
    const bytes = await uriToUint8Array(imageUri)

    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true })

    if (uploadErr) {
      console.log("[storage upload error]", uploadErr)
      throw makeError("UPLOAD_FAILED", "圖片上傳失敗", uploadErr.message)
    }
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e) throw e as FoodAnalysisError
    throw makeError(
      "UPLOAD_FAILED",
      "圖片上傳失敗",
      String((e as { message?: string })?.message ?? e),
    )
  }

  // 3) insert ai_jobs
  const { data: jobRow, error: jobCreateErr } = await supabase
    .from("ai_jobs")
    .insert({
      id: jobId,
      user_id: uid,
      status: "queued",
      model: "gemini-1.5-flash",
      image_path: path,
    })
    .select("id")
    .single()

  if (jobCreateErr || !jobRow?.id) {
    console.log("[ai_jobs insert error]", jobCreateErr)
    throw makeError(
      "JOB_CREATE_FAILED",
      "建立分析任務失敗",
      jobCreateErr ? JSON.stringify(jobCreateErr) : "unknown",
    )
  }

  // 4) ✅ 方案一：用 raw fetch 呼叫 function，拿到真正 body
  try {
    await invokeAiAnalyzeRaw(jobId)
  } catch (e: unknown) {
    const message = String((e as { message?: string })?.message ?? e)
    console.log("[raw invoke error]", message)

    // 方便 dashboard 追錯
    try {
      await supabase
        .from("ai_jobs")
        .update({
          status: "failed",
          error: message.slice(0, 900),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    } catch (u) {
      console.log("[ai_jobs update after raw invoke error failed]", String(u))
    }

    throw makeError("FUNCTION_FAILED", "呼叫分析服務失敗（raw fetch）", message)
  }

  // 5) poll ai_results
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { data: r, error: rErr } = await supabase
      .from("ai_results")
      .select("result_json")
      .eq("job_id", jobId)
      .maybeSingle()

    if (rErr) {
      console.log("[ai_results poll error]", rErr.message)
    } else if (r?.result_json) {
      return { jobId, result: r.result_json as FoodAnalysisResult }
    }

    await sleep(pollIntervalMs)
  }

  // timeout: read ai_jobs
  const { data: jobStatusRow, error: jobStatusErr } = await supabase
    .from("ai_jobs")
    .select("status,error")
    .eq("id", jobId)
    .maybeSingle()

  if (jobStatusErr) {
    throw makeError("TIMEOUT", "分析逾時，請稍後再試")
  }

  throw makeError(
    "TIMEOUT",
    "分析逾時，請稍後再試",
    JSON.stringify(jobStatusRow ?? null),
  )
}
