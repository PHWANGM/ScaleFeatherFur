// supabase/functions/ai-analyze/index.ts
import "edge-runtime";
import { createClient } from "supabase";

type FoodType = "vegetables" | "meat" | "fruit" | "mixed" | "unknown";

type FoodAnalysisResult = {
  foodType: FoodType;
  estimatedWeightGrams: number;
  identifiedItems: string[];
  confidence: number; // 0~1
  notes?: string;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Gemini response -> candidates[0].content.parts[0].text */
function getGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "{}";
  const obj = payload as Record<string, unknown>;
  const candidates = obj["candidates"];
  if (!Array.isArray(candidates) || candidates.length === 0) return "{}";
  const c0 = candidates[0];
  if (!c0 || typeof c0 !== "object") return "{}";
  const content = (c0 as Record<string, unknown>)["content"];
  if (!content || typeof content !== "object") return "{}";
  const parts = (content as Record<string, unknown>)["parts"];
  if (!Array.isArray(parts) || parts.length === 0) return "{}";
  const p0 = parts[0];
  if (!p0 || typeof p0 !== "object") return "{}";
  const text = (p0 as Record<string, unknown>)["text"];
  return typeof text === "string" ? text : "{}";
}

/** 避免 btoa(String.fromCharCode(...bytes)) 在大檔案炸掉 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** 從模型輸出中抽出 JSON 物件（容錯：去掉 code block / 找第一個 {...}） */
function extractJsonObject(text: string): string {
  let s = text.trim();
  s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

function normalizeFoodType(raw: unknown): FoodType {
  if (typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase();
  const valid: FoodType[] = ["vegetables", "meat", "fruit", "mixed", "unknown"];
  return valid.includes(lower as FoodType) ? (lower as FoodType) : "unknown";
}

/* =========================
   Minimal typing (no any)
   ========================= */

type DbError = { message: string };
type DbResult<T> = Promise<{ data: T | null; error: DbError | null }>;

type MinimalQueryBuilder = {
  select(columns: string): MinimalQueryBuilder;
  update(values: Record<string, unknown>): MinimalQueryBuilder;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): MinimalQueryBuilder;
  upsert(values: Record<string, unknown> | Record<string, unknown>[]): MinimalQueryBuilder;
  eq(column: string, value: string): MinimalQueryBuilder;
  single<T = unknown>(): DbResult<T>;
  maybeSingle<T = unknown>(): DbResult<T>;
};

type MinimalClient = {
  from(table: string): MinimalQueryBuilder;
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: DbError | null }>;
    };
  };
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: DbError | null }>;
  };
};

async function markJob(
  service: MinimalClient,
  jobId: string,
  patch: { status: string; error: string | null },
) {
  return await service
    .from("ai_jobs")
    .update({
      status: patch.status,
      error: patch.error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .maybeSingle();
}

/* =========================
   ✅ 防止 502：限制圖片大小
   ========================= */

const MAX_IMAGE_BYTES = 2_500_000; // 2.5MB

/* =========================
   ✅ Fetch with timeout
   ========================= */

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/* =========================
   ✅ Gemini: ListModels + Pick model + Generate
   ========================= */

type GeminiModelInfo = {
  name?: unknown; // e.g. "models/gemini-2.0-flash"
  supportedGenerationMethods?: unknown; // e.g. ["generateContent", ...]
};

function asString(x: unknown): string | null {
  return typeof x === "string" ? x : null;
}

function asStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v) => typeof v === "string") as string[] : [];
}

/**
 * ListModels（v1）：
 * GET https://generativelanguage.googleapis.com/v1/models?key=...
 */
async function listGeminiModels(apiKey: string): Promise<{ ok: true; modelNames: string[] } | { ok: false; status: number; bodyText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  const resp = await fetchWithTimeout(url, { method: "GET" }, 15_000);
  const text = await resp.text();
  if (!resp.ok) return { ok: false, status: resp.status, bodyText: text };

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, status: 500, bodyText: `ListModels invalid JSON: ${text.slice(0, 500)}` };
  }

  const obj = parsed as Record<string, unknown>;
  const models = obj["models"];
  if (!Array.isArray(models)) return { ok: false, status: 500, bodyText: `ListModels missing models[]: ${text.slice(0, 500)}` };

  // 只保留支援 generateContent 的 model
  const names: string[] = [];
  for (const m of models) {
    if (!m || typeof m !== "object") continue;
    const mi = m as GeminiModelInfo;

    const name = asString(mi.name);
    const methods = asStringArray(mi.supportedGenerationMethods);

    if (!name) continue;
    if (!methods.includes("generateContent")) continue;

    // API 回來通常是 "models/xxx"，我們呼叫 generateContent 需要的是 "xxx"
    // 但也接受直接是 "xxx" 的情況
    const cleaned = name.startsWith("models/") ? name.slice("models/".length) : name;
    names.push(cleaned);
  }

  return { ok: true, modelNames: names };
}

function pickBestModel(modelNames: string[]): string | null {
  // 你要 Vision + 便宜快：優先 Flash 類，其次任意支援 generateContent 的
  const prefer = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
  ];

  for (const p of prefer) {
    const hit = modelNames.find((m) => m === p || m.startsWith(`${p}-`));
    if (hit) return hit;
  }

  // fallback：任何包含 flash
  const flash = modelNames.find((m) => m.toLowerCase().includes("flash"));
  if (flash) return flash;

  return modelNames.length > 0 ? modelNames[0] : null;
}

async function generateWithGemini(params: {
  apiKey: string;
  model: string;
  prompt: string;
  mimeType: string;
  base64Data: string;
}): Promise<{ ok: true; rawText: string } | { ok: false; status: number; bodyText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${params.model}:generateContent?key=${params.apiKey}`;

  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: params.prompt },
              { inlineData: { mimeType: params.mimeType, data: params.base64Data } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2 },
      }),
    },
    20_000,
  );

  const text = await resp.text();
  if (!resp.ok) return { ok: false, status: resp.status, bodyText: text };

  let geminiJson: unknown;
  try {
    geminiJson = JSON.parse(text) as unknown;
  } catch {
    // 極少數情況不是 JSON：直接回 raw
    return { ok: true, rawText: text };
  }

  return { ok: true, rawText: getGeminiText(geminiJson) };
}

async function callGeminiDynamic(params: {
  apiKey: string;
  prompt: string;
  mimeType: string;
  base64Data: string;
}): Promise<{ ok: true; rawText: string } | { ok: false; status: number; bodyText: string }> {
  // 1) 如果你有手動指定，先試
  const preferred = (Deno.env.get("GEMINI_MODEL") ?? "").trim();
  const tried: { model: string; status: number; body: string }[] = [];

  if (preferred) {
    const r = await generateWithGemini({ ...params, model: preferred });
    if (r.ok) return r;
    tried.push({ model: preferred, status: r.status, body: r.bodyText.slice(0, 500) });
    // 如果不是 404（例如 403/429/400），直接回，不用繼續浪費
    if (r.status !== 404) return { ok: false, status: r.status, bodyText: r.bodyText };
  }

  // 2) ListModels 找可用模型
  const list = await listGeminiModels(params.apiKey);
  if (!list.ok) {
    return { ok: false, status: list.status, bodyText: `ListModels failed: ${list.bodyText}` };
  }

  const picked = pickBestModel(list.modelNames);
  if (!picked) {
    return { ok: false, status: 500, bodyText: `No models available. models=${JSON.stringify(list.modelNames.slice(0, 20))}` };
  }

  // 3) 試 picked；若剛好 picked 又失敗，retry 一次（針對 5xx/429）
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await generateWithGemini({ ...params, model: picked });
    if (r.ok) return r;

    tried.push({ model: picked, status: r.status, body: r.bodyText.slice(0, 500) });

    if ((r.status >= 500 && r.status <= 599) || r.status === 429) {
      if (attempt === 0) {
        await sleep(400);
        continue;
      }
    }

    return {
      ok: false,
      status: r.status,
      bodyText: `Gemini generate failed. picked=${picked} tried=${JSON.stringify(tried)} full=${r.bodyText}`,
    };
  }

  return { ok: false, status: 500, bodyText: `Gemini failed. tried=${JSON.stringify(tried)}` };
}

/* =========================
   Handler
   ========================= */

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
      return json(
        {
          error: "Missing env",
          detail: "Require SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY",
        },
        500,
      );
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // ✅ no-verify-jwt：由這裡驗證身份
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    }) as unknown as MinimalClient;

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "Not authenticated" }, 401);
    const uid = authData.user.id;

    // body
    let job_id = "";
    try {
      const body = (await req.json()) as Record<string, unknown>;
      job_id = typeof body["job_id"] === "string" ? (body["job_id"] as string) : "";
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!job_id) return json({ error: "Missing job_id" }, 400);

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    }) as unknown as MinimalClient;

    // load job + ownership
    const { data: jobUnknown, error: jobErr } = await service
      .from("ai_jobs")
      .select("id,user_id,image_path,status,model")
      .eq("id", job_id)
      .single();

    if (jobErr || !jobUnknown) return json({ error: "Job not found" }, 404);

    const job = jobUnknown as { id: string; user_id: string; image_path: string };
    if (job.user_id !== uid) return json({ error: "Forbidden" }, 403);

    await markJob(service, job_id, { status: "running", error: null });

    // ===== Storage: signed url -> fetch bytes =====
    const bucket = "ai-images";
    const { data: signed, error: signErr } = await service.storage
      .from(bucket)
      .createSignedUrl(job.image_path, 60);

    if (signErr || !signed?.signedUrl) {
      await markJob(service, job_id, { status: "failed", error: "Failed to sign url" });
      return json({ error: "Failed to access image" }, 500);
    }

    const imageResp = await fetchWithTimeout(signed.signedUrl, { method: "GET" }, 15_000);
    if (!imageResp.ok) {
      await markJob(service, job_id, { status: "failed", error: `Failed to fetch image: ${imageResp.status}` });
      return json({ error: "Failed to fetch image" }, 500);
    }

    const contentType = imageResp.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await imageResp.arrayBuffer());

    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      const msg = `Image too large: ${bytes.byteLength} bytes (limit ${MAX_IMAGE_BYTES}). Please resize/compress before upload.`;
      await markJob(service, job_id, { status: "failed", error: msg.slice(0, 900) });
      return json({ error: "IMAGE_TOO_LARGE", detail: msg }, 413);
    }

    const base64 = bytesToBase64(bytes);

    // ===== Gemini call (dynamic) =====
    const prompt = `
You are a pet food image analyzer.
Return STRICT JSON only with schema:
{
  "foodType": "vegetables"|"meat"|"fruit"|"mixed"|"unknown",
  "estimatedWeightGrams": number,
  "identifiedItems": string[],
  "confidence": number,
  "notes": string
}
Rules:
- estimatedWeightGrams must be a reasonable estimate. If unsure, pick best estimate and lower confidence.
- confidence is 0~1.
- identifiedItems list up to 6 items.
`.trim();

    const gem = await callGeminiDynamic({
      apiKey: GEMINI_API_KEY,
      prompt,
      mimeType: contentType,
      base64Data: base64,
    });

    if (!gem.ok) {
      await markJob(service, job_id, { status: "failed", error: gem.bodyText.slice(0, 900) });
      return json({ error: "Gemini failed", detail: gem.bodyText }, 500);
    }

    let parsed: FoodAnalysisResult;
    try {
      const jsonText = extractJsonObject(String(gem.rawText));
      const obj = JSON.parse(jsonText) as Record<string, unknown>;

      parsed = {
        foodType: normalizeFoodType(obj["foodType"]),
        estimatedWeightGrams: Math.max(0, Math.round(Number(obj["estimatedWeightGrams"]) || 0)),
        identifiedItems: Array.isArray(obj["identifiedItems"])
          ? (obj["identifiedItems"] as unknown[]).filter((x) => typeof x === "string").slice(0, 6) as string[]
          : [],
        confidence: Math.min(1, Math.max(0, Number(obj["confidence"]) || 0)),
        notes: typeof obj["notes"] === "string" ? (obj["notes"] as string) : undefined,
      };
    } catch {
      await markJob(service, job_id, { status: "failed", error: "Invalid JSON from model" });
      return json({ error: "Invalid model output" }, 500);
    }

    await service
      .from("ai_results")
      .upsert({
        job_id,
        result_json: parsed,
        created_at: new Date().toISOString(),
      });

    await markJob(service, job_id, { status: "succeeded", error: null });
    return json({ ok: true, job_id });
  } catch (e) {
    // ✅ 保底：避免 runtime 掛掉變 502 HTML
    return json({ error: "UNCAUGHT", detail: String(e) }, 500);
  }
});
