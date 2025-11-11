// src/lib/compliance/envTempForecast.service.ts
import { getEffectiveTargetForPet } from '../db/repos/species.targets.repo';

export type TempRiskKind = 'ok' | 'too_cold' | 'too_hot' | 'unknown';

export type HourlyTempRisk = {
  /** 從「現在」起算的 offset（0 = 這一小時，1 = 下一小時 ...） */
  hourOffset: number;
  /** 當地小時（0–23），= (現在小時 + hourOffset) % 24 */
  localHour: number;
  temp_c: number | null;
  risk: TempRiskKind;
};

export type TempRiskSegment = {
  /** 從「現在」起算的 offset 起點（含） */
  fromOffset: number;
  /** 從「現在」起算的 offset 終點（含） */
  toOffset: number;
  /** 起始小時（0–23，用來顯示幾點） */
  fromHour: number;
  /** 結束小時（0–23，用來顯示幾點） */
  toHour: number;
  risk: TempRiskKind;
};

export type Next24hTempRiskResult = {
  petId: string;
  /** 實際有幾個小時被檢查（通常是 24） */
  hoursChecked: number;

  ambientMin: number | null;
  ambientMax: number | null;

  hasTooCold: boolean;
  hasTooHot: boolean;
  /** 只要有 too_cold 或 too_hot 就 true → UI 可以直接用來顯示預警 */
  shouldWarn: boolean;

  hourly: HourlyTempRisk[];
  segments: TempRiskSegment[];
};

/**
 * 使用「從現在開始往後的連續溫度陣列（最多 24h）」 + petId，
 * 計算環境溫度對該寵物的風險：
 *
 * - next24TempC[0] = 現在這一小時
 * - next24TempC[1] = 下一小時
 * - ...
 * - 允許跨天（例如晚上 22:00 開始往後 24h，會含隔天的清晨）
 *
 * UI 可以使用：
 * - hourly[i].localHour → 當地幾點
 * - segments[].fromHour / toHour → 「幾點到幾點」都處於相同風險
 */
export async function evaluateNext24hAmbientTempForPetFromTodayHourly(
  petId: string,
  next24TempC: number[],
  now: Date = new Date()
): Promise<Next24hTempRiskResult | null> {
  const target = await getEffectiveTargetForPet(petId);
  if (!target) return null;

  const min = target.ambient_temp_c_min ?? null;
  const max = target.ambient_temp_c_max ?? null;
  if (min == null || max == null) {
    // 沒有 ambient 範圍 → 無法評估
    return null;
  }

  const nowHour = now.getHours(); // 0–23
  const hourly: HourlyTempRisk[] = [];

  let hasTooCold = false;
  let hasTooHot = false;

  // 逐小時判斷風險
  next24TempC.forEach((t, offset) => {
    const localHour = (nowHour + offset) % 24;

    let risk: TempRiskKind;
    if (t == null || Number.isNaN(t)) {
      risk = 'unknown';
    } else if (t < min) {
      risk = 'too_cold';
      hasTooCold = true;
    } else if (t > max) {
      risk = 'too_hot';
      hasTooHot = true;
    } else {
      risk = 'ok';
    }

    hourly.push({
      hourOffset: offset,
      localHour,
      temp_c: t ?? null,
      risk,
    });
  });

  const hoursChecked = hourly.length;
  const shouldWarn = hasTooCold || hasTooHot;

  // 將連續同一 risk 的小時依 hourOffset 合併成 segments
  const segments: TempRiskSegment[] = [];
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
    ambientMin: min,
    ambientMax: max,
    hasTooCold,
    hasTooHot,
    shouldWarn,
    hourly,
    segments,
  };
}
