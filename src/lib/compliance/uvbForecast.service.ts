// src/lib/compliance/uvbForecast.service.ts
import { getEffectiveTargetForPet } from '../db/repos/species.targets.repo';

export type UvbRiskKind = 'ok' | 'too_low' | 'too_high' | 'unknown';

export type HourlyUvbRisk = {
  /**
   * 從「輸入陣列的第 0 筆」起算的 offset
   * - 0 = next24Uvi[0] / timesLocal[0]
   * - 1 = next24Uvi[1] / timesLocal[1]
   * - ...
   */
  hourOffset: number;

  /**
   * 當地小時（0–23），直接由 timesLocal 解析出 HH，
   * 不依賴裝置時區。
   */
  localHour: number | null;

  /** 該小時的當地時間 ISO 字串（含 offset），例如 "2025-11-11T11:00+08:00" */
  localIso: string | null;

  /** 該小時的 UV 指數（或 UVB 強度，依你接的單位而定） */
  uv: number | null;

  risk: UvbRiskKind;
};

export type UvbRiskSegment = {
  /** 從「第 0 筆」起算的 offset 起點（含） */
  fromOffset: number;
  /** 從「第 0 筆」起算的 offset 終點（含） */
  toOffset: number;
  /** 起始小時（0–23，用來顯示幾點） */
  fromHour: number | null;
  /** 結束小時（0–23，用來顯示幾點） */
  toHour: number | null;
  risk: UvbRiskKind;
};

export type Next24hUvbRiskResult = {
  petId: string;
  /** 實際有幾個小時被檢查（通常是 24） */
  hoursChecked: number;

  /** 物種設定的 UVB 最小/最大強度（單位要在 rules / UI 層解讀） */
  uvbMin: number | null;
  uvbMax: number | null;

  hasTooLow: boolean;
  hasTooHigh: boolean;
  /** 只要有 too_low 或 too_high 就 true → UI 可以直接用來顯示預警 */
  shouldWarn: boolean;

  hourly: HourlyUvbRisk[];
  segments: UvbRiskSegment[];
};

/**
 * 由當地時間字串（含 offset）解析「當地小時」：
 * 期待格式類似：
 *   "2025-11-11T11:00+08:00"
 *   "2025-11-11T03:00Z"
 *   "2025-11-11T11:00:30+08:00"
 *
 * 我們只取 T 之後前兩位的 HH，不依賴裝置時區。
 */
function extractLocalHourFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const parts = iso.split('T');
  if (parts.length < 2) return null;
  const timePart = parts[1];

  // 可能是 "11:00+08:00" / "03:00Z" / "11:00:30+08:00"
  const hhStr = timePart.slice(0, 2);
  const hh = Number(hhStr);
  if (Number.isNaN(hh) || hh < 0 || hh > 23) return null;
  return hh;
}

/**
 * 使用「從現在開始往後的連續 UVB / UVI 陣列（最多 24h）」 + petId，
 * 計算 UVB 強度對該寵物的風險。
 *
 * - next24Uvi[i] 對應 timesLocal[i]
 * - next24Uvi[0] / timesLocal[0] = 現在這一小時
 * - next24Uvi[1] / timesLocal[1] = 下一小時
 * - ...
 * - 允許跨天（例如晚上 16:00 開始往後 24h，會含隔天的上午）
 *
 * 風險判斷依據 species_targets：
 * - uvb_intensity_min / uvb_intensity_max
 * （具體單位例如 μW/cm²、UVI，請在 rules / UI 層統一解讀）
 */
export async function evaluateNext24hUvbForPetFromTodayHourly(
  petId: string,
  next24Uvi: number[],
  timesLocal: string[]
): Promise<Next24hUvbRiskResult | null> {
  const target = await getEffectiveTargetForPet(petId);
  if (!target) return null;

  const uvbMin = target.uvb_intensity_min ?? null;
  const uvbMax = target.uvb_intensity_max ?? null;

  // 若沒有 UVB 強度範圍 → 暫時無法評估
  if (uvbMin == null || uvbMax == null) {
    return null;
  }

  const hourly: HourlyUvbRisk[] = [];
  let hasTooLow = false;
  let hasTooHigh = false;

  // 逐小時判斷 UVB 風險
  next24Uvi.forEach((val, offset) => {
    const localIso = timesLocal[offset] ?? null;
    const localHour = extractLocalHourFromIso(localIso);

    let risk: UvbRiskKind;
    if (val == null || Number.isNaN(val)) {
      risk = 'unknown';
    } else if (val < uvbMin) {
      risk = 'too_low';
      hasTooLow = true;
    } else if (val > uvbMax) {
      risk = 'too_high';
      hasTooHigh = true;
    } else {
      risk = 'ok';
    }

    hourly.push({
      hourOffset: offset,
      localHour,
      localIso,
      uv: val ?? null,
      risk,
    });
  });

  const hoursChecked = hourly.length;
  const shouldWarn = hasTooLow || hasTooHigh;

  // 將連續同一 risk 的小時依 hourOffset 合併成 segments
  const segments: UvbRiskSegment[] = [];
  for (const h of hourly) {
    const last = segments[segments.length - 1];

    if (
      last &&
      last.risk === h.risk &&
      h.hourOffset === last.toOffset + 1 // 依 offset 判斷是否連續（支援跨午夜）
    ) {
      last.toOffset = h.hourOffset;
      last.toHour = h.localHour;
    } else {
      segments.push({
        fromOffset: h.hourOffset,
        toOffset: h.hourOffset,
        fromHour: h.localHour,
        toHour: h.localHour,
        risk: h.risk,
      });
    }
  }
  return {
    petId,
    hoursChecked,
    uvbMin,
    uvbMax,
    hasTooLow,
    hasTooHigh,
    shouldWarn,
    hourly,
    segments,
  };
}
