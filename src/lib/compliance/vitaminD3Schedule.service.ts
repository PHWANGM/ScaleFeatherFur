// src/lib/compliance/vitaminD3Schedule.service.ts
import { getEffectiveTargetForPet } from '../db/repos/species.targets.repo';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
} from '../db/repos/care.logs';

export type VitaminD3RiskKind = 'due_soon' | 'overdue';

export type VitaminD3ScheduleResult = {
  petId: string;

  vitaminIntervalMinDays: number | null;
  vitaminIntervalMaxDays: number | null;

  lastVitaminAt: string | null;        // 最近一次 D3 補充時間（ISO）
  daysSinceLastVitamin: number | null; // 距離上次補充的「天數」

  nextVitaminWindowStart: string | null; // 建議補充時間窗開始（ISO）
  nextVitaminWindowEnd: string | null;   // 建議補充時間窗結束（ISO）

  risk: VitaminD3RiskKind;

  /**
   * 是否要顯示提醒卡片：
   * - 只要有設定 D3 interval，就一律 true（HomeScreen 可以永遠顯示一張 D3 卡）
   */
  shouldWarn: boolean;
};

/**
 * 規則：
 * - 讀取 species_targets 的 vitamin_d3_interval_days_min / max
 * - 找出最近一次 D3 補充（vitamin 或 calcium_d3）
 * - 計算距離上次補充幾天，判斷是否 overdue / due_soon
 *
 * 風險定義：
 * - overdue  ：daysSince > maxDays
 * - due_soon ：其他所有可評估情況（包含「還很早」、已進入時間窗、沒有 maxDays、尚未有補充紀錄）
 */
export async function evaluateVitaminD3ScheduleForPet(
  petId: string
): Promise<VitaminD3ScheduleResult | null> {
  const target = await getEffectiveTargetForPet(petId);
  if (!target) return null;

  const minDays = target.vitamin_d3_interval_days_min ?? null;
  const maxDays = target.vitamin_d3_interval_days_max ?? null;

  // 物種完全沒有設定 D3 interval → 不顯示這張卡片
  if (minDays == null && maxDays == null) {
    return null;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const epochIso = '1970-01-01T00:00:00.000Z';

  // 1️⃣ 撈出所有跟 D3 相關的補充紀錄
  const suppLogs = await listCareLogsByPetBetween(
    petId,
    epochIso,
    nowIso,
    ['vitamin', 'calcium']
  );

  const d3Logs: CareLogRow[] = suppLogs.filter((log) => {
    // 視所有 vitamin 為 D3 / 維他命補充
    if (log.type === 'vitamin') return true;
    // 或 calcium + subtype = 'calcium_d3'
    if (log.type === 'calcium' && log.subtype === 'calcium_d3') return true;
    return false;
  });

  // listCareLogsByPetBetween 已經 ORDER BY at ASC
  const lastVitamin = d3Logs.length > 0 ? d3Logs[d3Logs.length - 1] : null;

  let lastVitaminAt: string | null = null;
  let daysSince: number | null = null;
  let risk: VitaminD3RiskKind = 'due_soon';

  if (lastVitamin?.at) {
    lastVitaminAt = lastVitamin.at;
    const lastDate = new Date(lastVitamin.at);
    const diffMs = now.getTime() - lastDate.getTime();
    daysSince = diffMs / (1000 * 60 * 60 * 24);
  }

  // 預設為 due_soon；只有有 maxDays & daysSince > maxDays 才是 overdue
  if (daysSince != null && maxDays != null && daysSince > maxDays) {
    risk = 'overdue';
  } else {
    risk = 'due_soon';
  }

  // 2️⃣ 計算「建議補充時間窗」 [last + minDays, last + maxDays]
  let nextStart: string | null = null;
  let nextEnd: string | null = null;

  if (lastVitaminAt && minDays != null) {
    const d = new Date(lastVitaminAt);
    d.setDate(d.getDate() + minDays);
    nextStart = d.toISOString();
  }

  if (lastVitaminAt && maxDays != null) {
    const d2 = new Date(lastVitaminAt);
    d2.setDate(d2.getDate() + maxDays);
    nextEnd = d2.toISOString();
  }

  return {
    petId,
    vitaminIntervalMinDays: minDays,
    vitaminIntervalMaxDays: maxDays,
    lastVitaminAt,
    daysSinceLastVitamin: daysSince,
    nextVitaminWindowStart: nextStart,
    nextVitaminWindowEnd: nextEnd,
    risk,
    shouldWarn: true,
  };
}
