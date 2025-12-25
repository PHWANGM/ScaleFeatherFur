// src/lib/ai/gemini.service.ts
import { getGeminiApiKey, GEMINI_CONFIG } from './config';
import {
  getMimeTypeFromUri,
  getFileSize,
  compressAndConvertToBase64,
} from '../utils/imageUtils';

// ========== 類型定義 ==========

export type FoodType = 'vegetables' | 'hay' | 'meat' | 'fruit' | 'insects' | 'mixed' | 'unknown';

export type FoodAnalysisResult = {
  foodType: FoodType;
  estimatedWeightGrams: number;
  confidence: number; // 0-1
  identifiedItems: string[];
  rawResponse?: string;
};

export type FoodAnalysisError = {
  code: 'NETWORK_ERROR' | 'API_KEY_MISSING' | 'API_KEY_INVALID' | 'QUOTA_EXCEEDED' |
        'IMAGE_TOO_LARGE' | 'PARSE_ERROR' | 'PERMISSION_DENIED' | 'UNKNOWN';
  message: string;
  details?: string;
};

// ========== 錯誤訊息對照表 ==========

const ERROR_MESSAGES: Record<FoodAnalysisError['code'], string> = {
  NETWORK_ERROR: '網路連線失敗，請檢查網路後重試',
  API_KEY_MISSING: 'AI 功能未設定，請在設定中加入 API Key',
  API_KEY_INVALID: 'API Key 無效，請檢查設定',
  QUOTA_EXCEEDED: 'API 配額已用盡，請稍後再試',
  IMAGE_TOO_LARGE: '圖片過大，請使用較小的圖片',
  PARSE_ERROR: '無法分析此圖片，請嘗試其他照片',
  PERMISSION_DENIED: '權限被拒絕',
  UNKNOWN: '發生未預期的錯誤，請稍後再試',
};

// ========== Prompt 設計 ==========

const FOOD_ANALYSIS_PROMPT = `You are an expert pet food analyst specializing in reptile, tortoise, and exotic pet nutrition. Analyze this pet food image with high precision and respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation).

Required JSON format:
{
  "foodType": "vegetables" | "hay" | "meat" | "fruit" | "insects" | "mixed" | "unknown",
  "estimatedWeightGrams": <number>,
  "confidence": <number between 0 and 1>,
  "identifiedItems": ["specific item name 1", "specific item name 2", ...]
}

CRITICAL: Be SPECIFIC in identifiedItems. Use exact names, not generic terms.

Food Type Guidelines:
- "hay": Timothy hay, orchard grass, bermuda grass, alfalfa hay, meadow hay, oat hay
- "vegetables": Leafy greens (kale, collard greens, dandelion greens, turnip greens, mustard greens, endive, escarole, watercress, arugula, bok choy, romaine lettuce), squash, bell peppers, carrots, zucchini, pumpkin
- "meat": Chicken, turkey, beef, fish, shrimp, eggs, organ meats (liver, heart), pinky mice
- "fruit": Berries (strawberry, blueberry, raspberry), papaya, mango, banana, melon, apple, pear, figs
- "insects": Dubia roaches, crickets, mealworms, superworms, black soldier fly larvae (BSFL/phoenix worms), hornworms, silkworms, waxworms, grasshoppers, locusts
- "mixed": Clear combination of multiple food types
- "unknown": Cannot identify with confidence

Identification Examples (BE THIS SPECIFIC):
- Say "timothy hay" not just "hay"
- Say "collard greens" not just "greens"
- Say "dubia roaches" not just "insects"
- Say "butternut squash" not just "squash"

Weight estimation tips:
- Hay: A handful is typically 30-80g, a large pile 100-200g
- Leafy greens: 20-100g per handful depending on density
- Insects: 5-30g per portion (crickets ~0.3g each, dubias ~1-3g each)
- Fruit pieces: 10-50g depending on size
- Use visual cues like plate size, container, hand comparison

Respond with ONLY the JSON object.`;

// ========== API 呼叫 ==========

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * 分析食物圖片
 * @param imageUri 本地圖片 file:// URI
 * @returns 分析結果
 * @throws FoodAnalysisError
 */
export async function analyzeFoodImage(imageUri: string): Promise<FoodAnalysisResult> {
  // 1. 取得 API Key
  let apiKey: string;
  try {
    apiKey = await getGeminiApiKey();
  } catch (err: any) {
    if (err?.message === 'API_KEY_NOT_SET') {
      throw createError('API_KEY_MISSING');
    }
    throw createError('API_KEY_MISSING', err?.message);
  }

  // 2. 檢查原始圖片大小並記錄
  const originalSize = await getFileSize(imageUri);
  console.log(`[gemini] Original image size: ${formatBytes(originalSize ?? 0)}`);

  // 3. 壓縮圖片並轉換為 Base64
  let base64Image: string;
  let compressedUri: string;
  try {
    const result = await compressAndConvertToBase64(imageUri, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.7,
      targetMaxBytes: 1 * 1024 * 1024, // 1MB target
    });
    base64Image = result.base64;
    compressedUri = result.compressedUri;

    const compressedSize = await getFileSize(compressedUri);
    console.log(`[gemini] Compressed image size: ${formatBytes(compressedSize ?? 0)}`);
  } catch (err: any) {
    console.error('[gemini] Image processing failed:', err);
    throw createError('UNKNOWN', '無法處理圖片檔案');
  }

  // 壓縮後的圖片都是 JPEG
  const mimeType = 'image/jpeg';

  // 4. 建構請求
  const requestBody = {
    contents: [{
      parts: [
        { text: FOOD_ANALYSIS_PROMPT },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Image,
          },
        },
      ],
    }],
    generationConfig: {
      temperature: GEMINI_CONFIG.temperature,
      maxOutputTokens: GEMINI_CONFIG.maxTokens,
    },
  };

  // 5. 發送請求
  console.log('[gemini] Sending API request...');
  let response: Response;
  try {
    response = await fetch(`${GEMINI_CONFIG.apiEndpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    console.log('[gemini] API response status:', response.status);
  } catch (err: any) {
    console.error('[gemini] Network error:', err);
    throw createError('NETWORK_ERROR', err?.message);
  }

  // 6. 處理回應
  const json: GeminiResponse = await response.json();
  console.log('[gemini] API response received');

  // 檢查 API 錯誤
  if (!response.ok || json.error) {
    console.error('[gemini] API error:', json.error);
    return handleApiError(response.status, json.error);
  }

  // 7. 解析回應
  const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('[gemini] Response text:', textContent?.substring(0, 200));
  if (!textContent) {
    throw createError('PARSE_ERROR', 'API 回應為空');
  }

  const result = parseGeminiResponse(textContent);
  console.log('[gemini] Parsed result:', JSON.stringify(result));
  return result;
}

/**
 * 帶重試的分析函數
 */
export async function analyzeFoodImageWithRetry(
  imageUri: string,
  maxRetries: number = 2
): Promise<FoodAnalysisResult> {
  let lastError: FoodAnalysisError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await analyzeFoodImage(imageUri);
    } catch (err: any) {
      lastError = err;

      // 不重試的錯誤類型
      const noRetryErrors: FoodAnalysisError['code'][] = [
        'API_KEY_MISSING',
        'API_KEY_INVALID',
        'IMAGE_TOO_LARGE',
        'QUOTA_EXCEEDED',
      ];

      if (noRetryErrors.includes(err?.code)) {
        throw err;
      }

      // 指數退避
      if (attempt < maxRetries) {
        await delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError ?? createError('UNKNOWN');
}

// ========== 輔助函數 ==========

function parseGeminiResponse(text: string): FoodAnalysisResult {
  // 移除可能的 markdown 代碼塊
  let jsonStr = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 嘗試找到 JSON 物件
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw createError('PARSE_ERROR', '無法解析 AI 回應');
  }

  // 驗證必要欄位
  const validFoodTypes: FoodType[] = ['vegetables', 'hay', 'meat', 'fruit', 'insects', 'mixed', 'unknown'];
  if (!validFoodTypes.includes(parsed.foodType)) {
    parsed.foodType = 'unknown';
  }

  return {
    foodType: parsed.foodType as FoodType,
    estimatedWeightGrams: Math.max(0, Math.round(Number(parsed.estimatedWeightGrams) || 0)),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    identifiedItems: Array.isArray(parsed.identifiedItems)
      ? parsed.identifiedItems.filter((item: any) => typeof item === 'string')
      : [],
    rawResponse: text,
  };
}

function handleApiError(status: number, error?: { code: number; message: string; status: string }): never {
  if (status === 401 || status === 403) {
    throw createError('API_KEY_INVALID', error?.message);
  }
  if (status === 429) {
    throw createError('QUOTA_EXCEEDED', error?.message);
  }
  if (status >= 500) {
    throw createError('NETWORK_ERROR', 'Gemini 服務暫時無法使用');
  }
  throw createError('UNKNOWN', error?.message ?? `HTTP ${status}`);
}

function createError(code: FoodAnalysisError['code'], details?: string): FoodAnalysisError {
  return {
    code,
    message: ERROR_MESSAGES[code],
    details,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 取得用戶友好的錯誤訊息
 */
export function getErrorMessage(error: FoodAnalysisError | Error | unknown): string {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return (error as FoodAnalysisError).message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return ERROR_MESSAGES.UNKNOWN;
}
