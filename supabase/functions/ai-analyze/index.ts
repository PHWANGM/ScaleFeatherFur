// supabase/functions/ai-analyze/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReqBody = {
  image_path: string; // e.g. "ai-images/<uid>/<file>.jpg"
  pet_id?: string;    // P0 可選
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Missing env. Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json()) as ReqBody;
    if (!body?.image_path) {
      return new Response(JSON.stringify({ error: "image_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) 用「使用者的 JWT」拿到 user（這樣你就知道是誰呼叫的）
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized (no valid JWT)" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const userId = userData.user.id;

    // 2) 用 service role 寫 DB（避免你 P0 還沒寫好 RLS 就卡住）
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 建立 job
    const { data: jobRow, error: jobErr } = await admin
      .from("ai_jobs")
      .insert({
        user_id: userId,
        pet_id: body.pet_id ?? null,
        image_path: body.image_path,
        status: "running",
        model: "fake-v0",
      })
      .select("id")
      .single();

    if (jobErr || !jobRow?.id) throw jobErr;

    const jobId = jobRow.id as string;

    // 3) 產生「假的分析結果」
    const fake = {
      version: "fake-v0",
      input: { image_path: body.image_path, pet_id: body.pet_id ?? null },
      estimate: {
        veg_g: 20,
        meat_g: 10,
        fruit_g: 5,
      },
      confidence: 0.42,
      notes: [
        "P0 假資料：先讓資料流跑通",
        "P1 再換成 Gemini/OpenAI 真正視覺分析",
      ],
    };

    // 寫入結果表
    const { error: resErr } = await admin
      .from("ai_results")
      .insert({ job_id: jobId, result_json: fake });

    if (resErr) throw resErr;

    // 更新 job 狀態
    const { error: upErr } = await admin
      .from("ai_jobs")
      .update({ status: "succeeded" })
      .eq("id", jobId);

    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ job_id: jobId, status: "succeeded", result: fake }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
