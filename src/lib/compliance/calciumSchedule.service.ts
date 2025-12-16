// src/lib/compliance/calciumSchedule.service.ts
import { getEffectiveTargetForPet } from '../db/repos/species.targets.repo';
import {
  listCareLogsByPetBetween,
  type CareLogRow,
  type CareLogType,
} from '../db/repos/care.logs';

export type CalciumRiskKind = 'due_soon' | 'overdue';

export type CalciumScheduleResult = {
  petId: string;

  /** 每幾餐要灑一次鈣粉（1 = 每餐） */
  calciumEveryMeals: number | null;

  /** 最近一次補鈣時間（type='calcium' 的 care_log.at，ISO） */
  lastCalciumAt: string | null;

  /** 最近一次補鈣之後，已經餵了幾餐（type='feed' 次數） */
  mealsSinceLastCalcium: number | null;

  /**
   * 距離「下一次建議補鈣」還剩幾餐
   * - 若 risk = 'due_soon' 且有資料 → >= 0 的整數
   * - 若 risk = 'overdue' 或沒有資料 → null
   */
  mealsRemainingUntilNext: number | null;

  risk: CalciumRiskKind;

  /** 只要能算出 schedule，就一律 true，讓 UI 永遠顯示提醒卡片 */
  shouldWarn: boolean;
};

function findLastCalciumLog(logs: CareLogRow[]): CareLogRow | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type === 'calcium') return logs[i];
  }
  return null;
}

/**
 * 根據：
 * - species_targets.calcium_every_meals
 * - care_logs: type='calcium' / 'feed'
 *
 * 來計算「已經隔了幾餐沒補鈣」以及提醒狀態。
 *
 * 定義：
 * - calciumEveryMeals = N
 * - mealsSinceLastCalcium = M
 *
 * 1) 若沒有任何補鈣紀錄：
 *    - 視為 overdue（提醒使用者先補一次）
 *
 * 2) 有補鈣紀錄時：
 *    - M >= N → overdue
 *    - M <  N → due_soon（還差 N - M 餐）
 */
export async function evaluateCalciumScheduleForPet(
  petId: string
): Promise<CalciumScheduleResult | null> {
  const target = await getEffectiveTargetForPet(petId);
  console.log('[CalciumSchedule] target =', target);
  if (!target) return null;

  const calciumEveryMeals = target.calcium_every_meals ?? null;
  console.log(
    '[CalciumSchedule] calciumEveryMeals =',
    calciumEveryMeals,
    'for pet',
    petId
  );

  // 物種沒有設定 calcium_every_meals 的話，就不顯示提醒
  if (calciumEveryMeals == null || calciumEveryMeals <= 0) {
    console.log('[CalciumSchedule] no calciumEveryMeals → return null');
    return null;
  }

  const nowIso = new Date().toISOString();
  const sinceEpoch = '1970-01-01T00:00:00.000Z';

  // 抓出這隻寵物的所有餵食/補鈣紀錄（從很久以前到現在）
  const logs = await listCareLogsByPetBetween(
    petId,
    sinceEpoch,
    nowIso,
    ['feed', 'calcium'] as CareLogType[]
  );

  console.log('[CalciumSchedule] logs count =', logs.length);

  const lastCalciumLog = findLastCalciumLog(logs);

  let lastCalciumAt: string | null = null;
  let mealsSinceLastCalcium: number | null = null;

  if (lastCalciumLog?.at) {
    lastCalciumAt = lastCalciumLog.at;

    mealsSinceLastCalcium = logs.filter(
      (log) => log.type === 'feed' && log.at > lastCalciumAt!
    ).length;
  }

  console.log(
    '[CalciumSchedule] lastCalciumAt =',
    lastCalciumAt,
    'mealsSinceLastCalcium =',
    mealsSinceLastCalcium
  );

  let risk: CalciumRiskKind = 'due_soon';
  let mealsRemainingUntilNext: number | null = null;

  if (lastCalciumAt == null || mealsSinceLastCalcium == null) {
    // 還沒有任何補鈣紀錄 → 視為已經該補鈣（overdue）
    risk = 'overdue';
  } else {
    if (mealsSinceLastCalcium >= calciumEveryMeals) {
      risk = 'overdue';
    } else {
      risk = 'due_soon';
      mealsRemainingUntilNext = Math.max(
        calciumEveryMeals - mealsSinceLastCalcium,
        0
      );
    }
  }

  const result: CalciumScheduleResult = {
    petId,
    calciumEveryMeals,
    lastCalciumAt,
    mealsSinceLastCalcium,
    mealsRemainingUntilNext,
    risk,
    shouldWarn: true,
  };

  console.log('[CalciumSchedule] result =', result);
  return result;
}
