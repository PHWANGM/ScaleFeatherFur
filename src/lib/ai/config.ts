// src/lib/ai/config.ts
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE_KEY = 'GEMINI_API_KEY';

// Gemini API 設定
export const GEMINI_CONFIG = {
  model: 'gemini-3-flash-preview',
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
  maxTokens: 1024,
  temperature: 0.1, // 低溫度確保穩定的結構化輸出
};

/**
 * 取得儲存的 Gemini API Key
 * @throws 若未設定 API Key
 */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const key = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    if (!key) {
      throw new Error('API_KEY_NOT_SET');
    }
    return key;
  } catch (err: any) {
    if (err?.message === 'API_KEY_NOT_SET') throw err;
    console.error('[config] Failed to get API key:', err);
    throw new Error('API_KEY_ACCESS_ERROR');
  }
}

/**
 * 儲存 Gemini API Key
 */
export async function setGeminiApiKey(key: string): Promise<void> {
  if (!key || key.trim().length === 0) {
    throw new Error('API Key 不可為空');
  }
  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key.trim());
}

/**
 * 刪除儲存的 API Key
 */
export async function clearGeminiApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

/**
 * 檢查是否已設定 API Key
 */
export async function hasGeminiApiKey(): Promise<boolean> {
  try {
    const key = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    return !!key && key.trim().length > 0;
  } catch {
    return false;
  }
}
