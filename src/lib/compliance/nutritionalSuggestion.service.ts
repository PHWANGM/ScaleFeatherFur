// src/lib/compliance/nutritionalSuggestion.service.ts
import { getEffectiveTargetForPet, type SpeciesTarget } from '../db/repos/species.targets.repo';
import { getPetWithSpeciesById } from '../db/repos/pets.repo';
import type { FoodType, FoodAnalysisResult } from '../ai/gemini.service';

// ========== 類型定義 ==========

export type DietRecommendation = {
  min: number | null; // 百分比 0-100
  max: number | null;
};

export type NutritionalSuggestion = {
  /** 是否符合物種飲食建議 */
  isWithinRecommendation: boolean;
  /** 主要訊息 */
  message: string;
  /** 詳細說明 */
  details: string;
  /** 寵物名稱 */
  petName: string;
  /** 物種名稱 */
  speciesName: string;
  /** 各類食物推薦比例 */
  recommendations: {
    vegetables: DietRecommendation;
    hay: DietRecommendation; // 乾草與蔬菜同屬纖維來源
    meat: DietRecommendation;
    fruit: DietRecommendation;
    insects: DietRecommendation; // 通常與 meat 相同（蛋白質來源）
  };
  /** 警告訊息列表 */
  warnings: string[];
  /** 提示訊息列表 */
  tips: string[];
};

// ========== 食物類型對應訊息 ==========

const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  vegetables: '蔬菜',
  hay: '乾草',
  meat: '肉類',
  fruit: '水果',
  insects: '昆蟲',
  mixed: '混合食物',
  unknown: '未知食物',
};

// ========== 主要函數 ==========

/**
 * 根據寵物和分析結果生成營養建議
 */
export async function generateNutritionalSuggestion(
  petId: string,
  analysis: FoodAnalysisResult
): Promise<NutritionalSuggestion> {
  // 取得寵物和物種資訊
  const pet = await getPetWithSpeciesById(petId);
  const target = await getEffectiveTargetForPet(petId);

  const petName = pet?.name ?? '您的寵物';
  const speciesName = pet?.species_name ?? pet?.species_key ?? '此物種';

  // 建立推薦值
  const recommendations = {
    vegetables: {
      min: target?.diet_veg_pct_min ?? null,
      max: target?.diet_veg_pct_max ?? null,
    },
    // 乾草與蔬菜同屬纖維來源（草食動物主食）
    hay: {
      min: target?.diet_veg_pct_min ?? null,
      max: target?.diet_veg_pct_max ?? null,
    },
    meat: {
      min: target?.diet_meat_pct_min ?? null,
      max: target?.diet_meat_pct_max ?? null,
    },
    fruit: {
      min: target?.diet_fruit_pct_min ?? null,
      max: target?.diet_fruit_pct_max ?? null,
    },
    // 昆蟲通常與肉類同屬蛋白質來源
    insects: {
      min: target?.diet_meat_pct_min ?? null,
      max: target?.diet_meat_pct_max ?? null,
    },
  };

  const warnings: string[] = [];
  const tips: string[] = [];
  let isWithinRecommendation = true;

  // 分析食物類型是否符合推薦
  const { foodType, identifiedItems } = analysis;
  const foodLabel = FOOD_TYPE_LABELS[foodType];

  // 生成訊息
  let message = '';
  let details = '';

  if (foodType === 'unknown') {
    message = '無法識別食物類型';
    details = '請確保照片清晰，並只拍攝食物本身。';
    isWithinRecommendation = false;
  } else if (foodType === 'mixed') {
    message = '偵測到混合食物';
    details = buildMixedFoodDetails(identifiedItems);
    tips.push('混合餵食有助於營養均衡');
  } else {
    const rec = recommendations[foodType as keyof typeof recommendations];
    message = `偵測到${foodLabel}`;

    if (rec.min !== null || rec.max !== null) {
      const recStr = formatPercentRange(rec.min, rec.max);
      details = `${speciesName}的${foodLabel}建議攝取比例：${recStr}`;

      // 根據食物類型生成特定建議
      const feedback = generateFeedback(foodType, rec, target, speciesName);
      if (feedback.warning) {
        warnings.push(feedback.warning);
        isWithinRecommendation = feedback.isOk;
      }
      if (feedback.tip) {
        tips.push(feedback.tip);
      }
    } else {
      details = `目前尚無${speciesName}的${foodLabel}攝取建議資料`;
    }
  }

  // 添加識別項目資訊
  if (identifiedItems.length > 0 && foodType !== 'unknown') {
    const itemsStr = identifiedItems.slice(0, 5).join('、');
    tips.push(`識別到的食材：${itemsStr}`);
  }

  // 添加通用提示
  if (target?.diet_note) {
    tips.push(`飲食備註：${target.diet_note}`);
  }

  return {
    isWithinRecommendation,
    message,
    details,
    petName,
    speciesName,
    recommendations,
    warnings,
    tips,
  };
}

/**
 * 快速檢查食物類型是否適合物種
 */
export async function quickCheckFoodType(
  petId: string,
  foodType: FoodType
): Promise<{ ok: boolean; message: string }> {
  const target = await getEffectiveTargetForPet(petId);
  const pet = await getPetWithSpeciesById(petId);
  const speciesName = pet?.species_name ?? '此物種';

  if (!target) {
    return { ok: true, message: '無可用的飲食建議資料' };
  }

  switch (foodType) {
    case 'vegetables':
    case 'hay': {
      const min = target.diet_veg_pct_min ?? 0;
      const label = foodType === 'hay' ? '乾草' : '蔬菜';
      if (min >= 70) {
        return { ok: true, message: `${speciesName}是草食性動物，${label}是主食` };
      }
      return { ok: true, message: `${label}是健康的選擇` };
    }

    case 'meat':
    case 'insects': {
      const meatMax = target.diet_meat_pct_max ?? 100;
      const vegMin = target.diet_veg_pct_min ?? 0;

      if (vegMin >= 80 && meatMax <= 10) {
        return {
          ok: false,
          message: `⚠️ ${speciesName}主要是草食性，蛋白質來源應限制在 ${meatMax}% 以內`,
        };
      }
      return { ok: true, message: '蛋白質來源對成長很重要' };
    }

    case 'fruit': {
      const fruitMax = target.diet_fruit_pct_max ?? 100;
      if (fruitMax <= 10) {
        return {
          ok: false,
          message: `⚠️ 水果對${speciesName}來說應作為點心，建議控制在 ${fruitMax}% 以內`,
        };
      }
      return { ok: true, message: '水果可作為點心' };
    }

    default:
      return { ok: true, message: '' };
  }
}

// ========== 輔助函數 ==========

function formatPercentRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    if (min === max) return `${min}%`;
    return `${min}–${max}%`;
  }
  if (min !== null) return `至少 ${min}%`;
  if (max !== null) return `最多 ${max}%`;
  return '無建議';
}

function buildMixedFoodDetails(items: string[]): string {
  if (items.length === 0) {
    return '偵測到多種食物類型的混合';
  }
  const itemsStr = items.slice(0, 5).join('、');
  return `包含：${itemsStr}`;
}

function generateFeedback(
  foodType: FoodType,
  rec: DietRecommendation,
  target: SpeciesTarget | null,
  speciesName: string
): { warning?: string; tip?: string; isOk: boolean } {
  const vegMin = target?.diet_veg_pct_min ?? 0;
  const meatMax = target?.diet_meat_pct_max ?? 100;
  const fruitMax = target?.diet_fruit_pct_max ?? 100;

  switch (foodType) {
    case 'vegetables':
    case 'hay':
      // 草食動物吃蔬菜/乾草總是好的
      if (vegMin >= 70) {
        return {
          tip: `${speciesName}是草食性動物，${foodType === 'hay' ? '乾草' : '蔬菜'}應佔飲食的主要部分`,
          isOk: true,
        };
      }
      return { isOk: true };

    case 'meat':
    case 'insects':
      // 檢查是否為草食動物
      if (vegMin >= 80 && meatMax <= 10) {
        return {
          warning: `${speciesName}是草食性動物，蛋白質攝取應控制在 ${meatMax}% 以內`,
          tip: '偶爾少量蛋白質是可以的，但不應作為主食',
          isOk: false,
        };
      }
      if (meatMax < 50) {
        return {
          tip: `建議蛋白質來源佔飲食的 ${formatPercentRange(rec.min, rec.max)}`,
          isOk: true,
        };
      }
      return { isOk: true };

    case 'fruit':
      // 水果通常應該限量
      if (fruitMax <= 10) {
        return {
          warning: `水果含糖量高，對${speciesName}來說應作為點心，建議控制在 ${fruitMax}% 以內`,
          isOk: false,
        };
      }
      if (fruitMax <= 20) {
        return {
          tip: '水果可作為偶爾的點心，但不應過量',
          isOk: true,
        };
      }
      return { isOk: true };

    default:
      return { isOk: true };
  }
}

/**
 * 取得物種的簡易飲食摘要
 */
export async function getDietSummary(petId: string): Promise<string | null> {
  const target = await getEffectiveTargetForPet(petId);
  if (!target) return null;

  const parts: string[] = [];

  const vegMin = target.diet_veg_pct_min ?? null;
  const vegMax = target.diet_veg_pct_max ?? null;
  if (vegMin !== null || vegMax !== null) {
    parts.push(`蔬菜 ${formatPercentRange(vegMin, vegMax)}`);
  }

  const meatMin = target.diet_meat_pct_min ?? null;
  const meatMax = target.diet_meat_pct_max ?? null;
  if (meatMin !== null || meatMax !== null) {
    parts.push(`蛋白質 ${formatPercentRange(meatMin, meatMax)}`);
  }

  const fruitMin = target.diet_fruit_pct_min ?? null;
  const fruitMax = target.diet_fruit_pct_max ?? null;
  if (fruitMin !== null || fruitMax !== null) {
    parts.push(`水果 ${formatPercentRange(fruitMin, fruitMax)}`);
  }

  return parts.length > 0 ? parts.join('、') : null;
}
