// src/lib/services/compliance.service.ts
import { query } from '../db.client';
import {
  getEffectiveTargetForPet,
  type SpeciesTarget,
  type DietSplit,
} from '../repos/species.targets.repo';
import {
  getWeekRangeContaining,
  getThisWeekRange,
  type WeekRangeOptions,
} from '../../time/week';

export type ZoneKey = 'basking' | 'hot' | 'cool' | 'ambient_day' | 'ambient_night';

export type MetricCompliance = {
  zone: ZoneKey;
  range: [number, number];
  inRangeRatio: number;   // 0~1 之間，代表期間內有幾%的讀值落在目標區間
  samples: number;        // 計算用樣本數（讀值筆數）
};

export type UVBCompliance = {
  targetHoursPerDay?: [number, number] | null; // 來自 species_targets.photoperiod_hours_min/max
  actualHours: number;      // 期間 UVB 總時數
  targetHoursRange: [number, number] | null; // min/max * 天數
  pass: boolean | null;     // 無目標資料 -> null
};

export type SupplementCompliance = {
  d3PerWeekRule?: string | null;  // 例如 "per_week:1-2"
  d3ActualCount: number;
  pass: boolean | null;
  plainCalciumCount: number;      // 參考用途
  vitaminCount: number;           // 參考用途
};

export type DietCompliance = {
  targetSplit?: DietSplit | null;             // 物種目標比例（greens/insect/meat/fruit）
  actualSplit: Partial<Record<keyof Required<DietSplit>, number>>; // 0~1 合計1
  gramsByCategory: Record<string, number>;    // 原始克數累計
  deviation: Record<string, number>;          // |actual - target|，無目標的鍵不列
  totalGrams: number;
};

export type TempCompliance = {
  perZone: MetricCompliance[];  // 各 zone 的達標率
};

export type ComplianceReport = {
  petId: string;
  startISO: string;
  endISO: string;
  target: SpeciesTarget | null;
  uvb: UVBCompliance;
  supplements: SupplementCompliance;
  diet: DietCompliance;
  temps: TempCompliance;
  notes: string[]; // 補充說明（例如沒有目標或樣本數不足）
};

/* ---------------- Internal helpers ---------------- */

function daysBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  const ms = Math.max(0, e - s);
  return ms / (1000 * 60 * 60 * 24);
}

function normalizeSplit(input: Record<string, number>): Record<string, number> {
  const entries = Object.entries(input).filter(([, v]) => typeof v === 'number' && v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of entries) out[k] = v / total;
  return out;
}

/** 解析 rules like "per_week:1-2" / "per_2_weeks:1" / "every_meal" */
function parseSupplementRule(rule?: string | null): { windowDays: number; min?: number; max?: number } | null {
  if (!rule) return null;
  if (rule === 'every_meal') return { windowDays: 7 }; // 無法以 count 驗證，給 7 天視窗但 pass 無法嚴格判
  const m1 = rule.match(/^per_week:(\d+)(?:-(\d+))?$/);
  if (m1) {
    const min = parseInt(m1[1], 10);
    const max = m1[2] ? parseInt(m1[2], 10) : undefined;
    return { windowDays: 7, min, max };
  }
  const m2 = rule.match(/^per_2_weeks:(\d+)$/);
  if (m2) {
    const min = parseInt(m2[1], 10);
    return { windowDays: 14, min, max: undefined };
  }
  return null;
}

/* ---------------- SQL building blocks ---------------- */

/** 期間 UVB 總時數（考慮跨界配對並進行區間裁切） */
async function getUvbHoursBetween(petId: string, startISO: string, endISO: string): Promise<number> {
  // 取 start 往前少量時間用來處理前一筆 on 狀態；這裡抓 3 天緩衝
  const startBuf = new Date(new Date(startISO).getTime() - 3 * 86400_000).toISOString();

  const rows = await query<{ hours: number }>(`
    WITH logs AS (
      SELECT at, type
      FROM care_logs
      WHERE pet_id = ?
        AND at >= ?
        AND at <  ?
        AND type IN ('uvb_on','uvb_off')
      ORDER BY at ASC
    ),
    pairs AS (
      SELECT
        LAG(type) OVER (ORDER BY at)      AS prev_type,
        LAG(at)   OVER (ORDER BY at)      AS prev_at,
        type, at
      FROM logs
    ),
    clipped AS (
      -- 只保留 "off" 事件，且前一筆是 "on" -> 表示一段完整的開燈區間
      -- 再將該區間裁切到 [startISO, endISO)
      SELECT
        MAX(julianday(MAX(min(?, at), prev_at)) - julianday(?)) * 24.0 AS _tmp1, -- not directly used
        (julianday(min(?, at)) - julianday(max(?, prev_at))) * 24.0 AS hours_raw
      FROM pairs
      WHERE type = 'uvb_off' AND prev_type = 'uvb_on'
    )
    SELECT COALESCE(SUM(MAX(0.0, MIN(hours_raw, (julianday(?) - julianday(?)) * 24.0))), 0.0) AS hours
    FROM (
      SELECT
        -- 每列 hours_raw 其實已經是裁切後（以 SQL 限制可再嚴謹），此處再 double clamp 保險
        (SELECT hours_raw FROM clipped) AS hours_raw
    );
  `, [petId, startBuf, endISO, startISO, startISO, endISO, startISO, endISO, startISO]);

  const val = rows[0]?.hours ?? 0;
  return Math.max(0, val);
}

/** 期間內各餵食分類克數 */
async function getDietGramsBetween(petId: string, startISO: string, endISO: string): Promise<Record<string, number>> {
  const rows = await query<{ subtype: string | null; grams: number }>(`
    SELECT subtype, COALESCE(SUM(value),0) AS grams
    FROM care_logs
    WHERE pet_id = ?
      AND at >= ?
      AND at <  ?
      AND type = 'feed'
    GROUP BY subtype
  `, [petId, startISO, endISO]);

  const out: Record<string, number> = {};
  for (const r of rows) {
    if (!r.subtype) continue;
    out[r.subtype] = r.grams ?? 0;
  }
  return out;
}

/** 期間內補充品次數 */
async function getSupplementCountsBetween(petId: string, startISO: string, endISO: string) {
  const rows = await query<{ subtype: string | null; cnt: number }>(`
    SELECT subtype, COUNT(*) AS cnt
    FROM care_logs
    WHERE pet_id = ?
      AND at >= ?
      AND at <  ?
      AND (type = 'calcium' OR type = 'vitamin')
    GROUP BY subtype
  `, [petId, startISO, endISO]);

  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (!r.subtype) continue;
    counts[r.subtype] = r.cnt ?? 0;
  }
  return counts;
}

/** 期間內各 zone 溫度達標率（以樣本筆數計） */
async function getTempInRangeRatios(
  petId: string,
  startISO: string,
  endISO: string,
  tempRanges: SpeciesTarget['temp_ranges']
): Promise<MetricCompliance[]> {
  const zones: ZoneKey[] = ['basking', 'hot', 'cool', 'ambient_day', 'ambient_night'];
  const results: MetricCompliance[] = [];

  for (const z of zones) {
    const range = tempRanges[z];
    if (!range) continue;

    const rows = await query<{ samples: number; in_range: number }>(`
      WITH samples AS (
        SELECT value
        FROM env_readings
        WHERE pet_id = ?
          AND at >= ?
          AND at <  ?
          AND metric = 'temp_c'
          AND zone = ?
      )
      SELECT
        (SELECT COUNT(*) FROM samples) AS samples,
        (SELECT COUNT(*) FROM samples WHERE value >= ? AND value <= ?) AS in_range
    `, [petId, startISO, endISO, z, range[0], range[1]]);

    const rec = rows[0];
    const samples = rec?.samples ?? 0;
    const inRange = rec?.in_range ?? 0;
    results.push({
      zone: z,
      range,
      inRangeRatio: samples > 0 ? inRange / samples : 0,
      samples,
    });
  }

  return results;
}

/* ---------------- Public API ---------------- */

/**
 * 產生合規報告（指定期間；預設傳入一週的 start/end）
 * 備註：UVB 小時數會用 photoperiod * 天數估計目標；D3 用 supplement_rules 比對；飲食用克數比例比對；
 * 溫度用讀值達標率（每個 zone）。
 */
export async function getComplianceReport(
  petId: string,
  startISO: string,
  endISO: string
): Promise<ComplianceReport> {
  const notes: string[] = [];
  const target = await getEffectiveTargetForPet(petId);

  /* ---- UVB ---- */
  const uvbHours = await getUvbHoursBetween(petId, startISO, endISO);
  let uvbPass: boolean | null = null;
  let uvbTargetRange: [number, number] | null = null;
  if (target?.photoperiod_hours_min != null && target?.photoperiod_hours_max != null) {
    const days = daysBetween(startISO, endISO);
    uvbTargetRange = [target.photoperiod_hours_min * days, target.photoperiod_hours_max * days];
    uvbPass = uvbHours >= uvbTargetRange[0] && uvbHours <= uvbTargetRange[1];
  } else {
    notes.push('缺少 photoperiod 目標，無法嚴格判斷 UVB 是否達標');
  }

  const uvb: UVBCompliance = {
    targetHoursPerDay: target?.photoperiod_hours_min != null && target?.photoperiod_hours_max != null
      ? [target.photoperiod_hours_min, target.photoperiod_hours_max]
      : null,
    actualHours: uvbHours,
    targetHoursRange: uvbTargetRange,
    pass: uvbPass,
  };

  /* ---- Supplements ---- */
  const counts = await getSupplementCountsBetween(petId, startISO, endISO);
  const d3Count = counts['calcium_d3'] ?? 0;
  const plainCount = counts['calcium_plain'] ?? 0;
  const vitaminCount = counts['vitamin_multi'] ?? 0;

  // 解析規則
  const d3RuleText: string | null = target?.supplement_rules?.calcium_d3 ?? null;
  const d3Rule = parseSupplementRule(d3RuleText);
  let d3Pass: boolean | null = null;
  if (!d3Rule) {
    notes.push('缺少 D3 規則或格式未知，無法嚴格判斷 D3 是否達標');
  } else {
    const windowDays = d3Rule.windowDays;
    const periodDays = daysBetween(startISO, endISO);
    // 如果評估期間與規則視窗不一致：簡單等比例推估閾值（也可改為滑動視窗）
    const scale = periodDays / windowDays;
    const min = d3Rule.min != null ? d3Rule.min * scale : undefined;
    const max = d3Rule.max != null ? d3Rule.max * scale : undefined;

    if (min == null && max == null) {
      d3Pass = null; // 規則不可驗證
    } else if (min != null && max != null) {
      d3Pass = d3Count >= Math.floor(min) && d3Count <= Math.ceil(max);
    } else if (min != null) {
      d3Pass = d3Count >= Math.floor(min);
    } else if (max != null) {
      d3Pass = d3Count <= Math.ceil(max);
    }
  }

  const supplements: SupplementCompliance = {
    d3PerWeekRule: d3RuleText,
    d3ActualCount: d3Count,
    pass: d3Pass,
    plainCalciumCount: plainCount,
    vitaminCount,
  };

  /* ---- Diet ---- */
  const gramsBySubtype = await getDietGramsBetween(petId, startISO, endISO);
  const mapToCategory: Record<string, keyof Required<DietSplit>> = {
    feed_greens: 'greens',
    feed_insect: 'insect',
    feed_meat: 'meat',
    feed_fruit: 'fruit',
  };

  const gramsByCategory: Record<string, number> = {};
  for (const [subtype, grams] of Object.entries(gramsBySubtype)) {
    const cat = mapToCategory[subtype];
    if (!cat) continue;
    gramsByCategory[cat] = (gramsByCategory[cat] ?? 0) + grams;
  }

  const totalGrams = Object.values(gramsByCategory).reduce((s, v) => s + v, 0);
  const actualSplit = normalizeSplit(gramsByCategory);
  const targetSplit = target?.diet_split ?? null;

  const deviation: Record<string, number> = {};
  if (targetSplit) {
    for (const key of Object.keys(targetSplit)) {
      const t = (targetSplit as any)[key] as number | undefined;
      if (typeof t !== 'number') continue;
      const a = actualSplit[key] ?? 0;
      deviation[key] = Math.abs(a - t);
    }
  } else {
    notes.push('缺少 diet_split 目標，僅顯示實際比例。');
  }

  const diet: DietCompliance = {
    targetSplit,
    actualSplit,
    gramsByCategory,
    deviation,
    totalGrams,
  };

  /* ---- Temps ---- */
  const temps: TempCompliance = {
    perZone: target?.temp_ranges
      ? await getTempInRangeRatios(petId, startISO, endISO, target.temp_ranges)
      : (notes.push('缺少 temp_ranges 目標，無法計算各溫區達標率。'), []),
  };

  return {
    petId,
    startISO,
    endISO,
    target: target ?? null,
    uvb,
    supplements,
    diet,
    temps,
    notes,
  };
}

/* ---------------- Week helpers integration ---------------- */

/**
 * 以某個日期所在的「那一週」為區間，產生合規報告。
 * 預設以 local 模式、週一為起點；可透過 opts 調整。
 */
export async function getComplianceReportForWeek(
  petId: string,
  dateISO: string,
  opts: WeekRangeOptions = {}
): Promise<ComplianceReport> {
  const { startISO, endISO } = getWeekRangeContaining(dateISO, opts);
  return getComplianceReport(petId, startISO, endISO);
}

/**
 * 以「本週」為區間，產生合規報告。
 * 預設以 local 模式、週一為起點；可透過 opts 調整。
 */
export async function getThisWeekCompliance(
  petId: string,
  opts: WeekRangeOptions = {}
): Promise<ComplianceReport> {
  const { startISO, endISO } = getThisWeekRange(opts);
  return getComplianceReport(petId, startISO, endISO);
}
