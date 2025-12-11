// src/lib/compliance/feedingSchedule.service.ts
import { getEffectiveTargetForPet } from '../db/repos/species.targets.repo';
import { getLatestFeedLogForPet } from '../db/repos/care.logs';

export type FeedingRiskKind = 'due_soon' | 'overdue';

export type FeedingScheduleResult = {
  petId: string;

  feedingIntervalMinHours: number | null;
  feedingIntervalMaxHours: number | null;

  lastFeedAt: string | null;           // 最近一次餵食時間（ISO）
  hoursSinceLastFeed: number | null;   // 距離上次餵食的「小時數」

  nextFeedWindowStart: string | null;  // 建議餵食窗口開始時間（ISO）
  nextFeedWindowEnd: string | null;    // 建議餵食窗口結束時間（ISO）

  risk: FeedingRiskKind;

  /**
   * 是否需要在 UI 顯示提醒：
   * - 只要有可用的 target & 計算出排程，就一律 true（讓 UI 永遠顯示一個餵食提醒卡片）
   */
  shouldWarn: boolean;
};

/**
 * 依照：
 * - species_targets.feeding_interval_hours_min / max
 * - care_logs 最近一次 type='feed'
 *
 * 來計算餵食風險與下一次餵食時間窗。
 *
 * 風險定義：
 * - overdue  ：hoursSinceLastFeed > maxH
 * - due_soon ：其他所有可評估情況（包含「還很早」、已進入時間窗、沒有 maxH 等）
 */
export async function evaluateFeedingScheduleForPet(
  petId: string
): Promise<FeedingScheduleResult | null> {
  const target = await getEffectiveTargetForPet(petId);
  if (!target) return null;

  const minH = target.feeding_interval_hours_min ?? null;
  const maxH = target.feeding_interval_hours_max ?? null;

  // 物種沒有設定餵食 interval 的話，暫時無法評估 → 不顯示
  if (minH == null && maxH == null) {
    return null;
  }

  const lastFeedLog = await getLatestFeedLogForPet(petId);
  const now = new Date();

  let lastFeedAt: string | null = null;
  let hoursSince: number | null = null;

  if (lastFeedLog?.at) {
    lastFeedAt = lastFeedLog.at;
    const lastFeedDate = new Date(lastFeedLog.at);
    const diffMs = now.getTime() - lastFeedDate.getTime();
    hoursSince = diffMs / (1000 * 60 * 60); // ms -> h
  }

  // 預設視為 due_soon（包含「還很早」與「尚未有紀錄」）
  let risk: FeedingRiskKind = 'due_soon';

  // 只有在有紀錄 & 有 maxH 時，才會變成 overdue
  if (hoursSince != null && maxH != null && hoursSince > maxH) {
    risk = 'overdue';
  }

  // 計算「建議餵食窗口」 [last + minH, last + maxH]
  let nextStart: string | null = null;
  let nextEnd: string | null = null;

  if (lastFeedAt && minH != null) {
    const d = new Date(lastFeedAt);
    d.setHours(d.getHours() + minH);
    nextStart = d.toISOString();
  }
  if (lastFeedAt && maxH != null) {
    const d2 = new Date(lastFeedAt);
    d2.setHours(d2.getHours() + maxH);
    nextEnd = d2.toISOString();
  }

  return {
    petId,
    feedingIntervalMinHours: minH,
    feedingIntervalMaxHours: maxH,
    lastFeedAt,
    hoursSinceLastFeed: hoursSince,
    nextFeedWindowStart: nextStart,
    nextFeedWindowEnd: nextEnd,
    risk,
    // ✅ 只要能算出來，就一律顯示 warning 卡片
    shouldWarn: true,
  };
}
