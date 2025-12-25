// src/hooks/useFoodAnalysis.ts
import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { useImagePicker } from '../lib/ui/useImagePicker';
import {
  analyzeFoodImageWithRetry,
  getErrorMessage,
  type FoodAnalysisResult,
  type FoodAnalysisError,
} from '../lib/ai/gemini.service';
import {
  generateNutritionalSuggestion,
  type NutritionalSuggestion,
} from '../lib/compliance/nutritionalSuggestion.service';
import { hasGeminiApiKey } from '../lib/ai/config';

// ========== 類型定義 ==========

export type FoodAnalysisState = {
  /** 是否正在分析中 */
  analyzing: boolean;
  /** 分析結果 */
  result: FoodAnalysisResult | null;
  /** 營養建議 */
  suggestion: NutritionalSuggestion | null;
  /** 錯誤訊息 */
  error: string | null;
  /** 當前分析的圖片 URI */
  imageUri: string | null;
  /** API Key 是否已設定 */
  hasApiKey: boolean;
};

export type UseFoodAnalysisReturn = {
  /** 當前狀態 */
  state: FoodAnalysisState;
  /** 從相機拍照並分析 */
  analyzeFromCamera: () => Promise<void>;
  /** 從相簿選擇並分析 */
  analyzeFromLibrary: () => Promise<void>;
  /** 清除分析結果 */
  clearResult: () => void;
  /** 檢查 API Key 是否已設定 */
  checkApiKey: () => Promise<boolean>;
};

// ========== 初始狀態 ==========

const initialState: FoodAnalysisState = {
  analyzing: false,
  result: null,
  suggestion: null,
  error: null,
  imageUri: null,
  hasApiKey: false,
};

// ========== Hook 實作 ==========

/**
 * 食物影像分析 Hook
 * @param petId 當前寵物 ID（用於生成營養建議）
 */
export function useFoodAnalysis(petId: string | null): UseFoodAnalysisReturn {
  const [state, setState] = useState<FoodAnalysisState>(initialState);
  const { pickFromLibrary, takePhoto } = useImagePicker();

  // 用於防止過期的請求覆蓋新結果
  const analysisIdRef = useRef(0);

  /**
   * 檢查 API Key 是否已設定
   */
  const checkApiKey = useCallback(async (): Promise<boolean> => {
    const hasKey = await hasGeminiApiKey();
    setState(prev => ({ ...prev, hasApiKey: hasKey }));
    return hasKey;
  }, []);

  /**
   * 執行分析的核心邏輯
   */
  const performAnalysis = useCallback(async (imageUri: string | null) => {
    if (!imageUri) {
      return; // 用戶取消選擇
    }

    const currentAnalysisId = ++analysisIdRef.current;

    // 檢查 API Key
    const hasKey = await hasGeminiApiKey();
    if (!hasKey) {
      setState(prev => ({
        ...prev,
        error: 'AI 功能未設定，請先在設定中加入 Gemini API Key',
        hasApiKey: false,
      }));
      return;
    }

    // 開始分析
    setState(prev => ({
      ...prev,
      analyzing: true,
      error: null,
      imageUri,
      result: null,
      suggestion: null,
      hasApiKey: true,
    }));

    try {
      // 呼叫 Gemini API 分析
      const result = await analyzeFoodImageWithRetry(imageUri);

      // 檢查是否為過期的請求
      if (currentAnalysisId !== analysisIdRef.current) {
        return;
      }

      // 生成營養建議（如果有選擇寵物）
      let suggestion: NutritionalSuggestion | null = null;
      if (petId) {
        try {
          suggestion = await generateNutritionalSuggestion(petId, result);
        } catch (err) {
          console.warn('[useFoodAnalysis] Failed to generate suggestion:', err);
          // 營養建議失敗不影響主要功能
        }
      }

      setState(prev => ({
        ...prev,
        analyzing: false,
        result,
        suggestion,
        error: null,
      }));
    } catch (err: unknown) {
      // 檢查是否為過期的請求
      if (currentAnalysisId !== analysisIdRef.current) {
        return;
      }

      const errorMessage = getErrorMessage(err);
      setState(prev => ({
        ...prev,
        analyzing: false,
        result: null,
        suggestion: null,
        error: errorMessage,
      }));

      // 顯示錯誤提示
      Alert.alert('分析失敗', errorMessage);
    }
  }, [petId]);

  /**
   * 從相機拍照並分析
   */
  const analyzeFromCamera = useCallback(async () => {
    try {
      const uri = await takePhoto();
      await performAnalysis(uri);
    } catch (err) {
      console.error('[useFoodAnalysis] Camera error:', err);
      Alert.alert('錯誤', '無法開啟相機');
    }
  }, [takePhoto, performAnalysis]);

  /**
   * 從相簿選擇並分析
   */
  const analyzeFromLibrary = useCallback(async () => {
    try {
      const uri = await pickFromLibrary();
      await performAnalysis(uri);
    } catch (err) {
      console.error('[useFoodAnalysis] Library error:', err);
      Alert.alert('錯誤', '無法開啟相簿');
    }
  }, [pickFromLibrary, performAnalysis]);

  /**
   * 清除分析結果
   */
  const clearResult = useCallback(() => {
    setState(prev => ({
      ...prev,
      result: null,
      suggestion: null,
      error: null,
      imageUri: null,
    }));
  }, []);

  return {
    state,
    analyzeFromCamera,
    analyzeFromLibrary,
    clearResult,
    checkApiKey,
  };
}

// ========== 輔助 Hooks ==========

/**
 * 將分析結果轉換為表單值的輔助函數
 */
export function useAnalysisToFormValues(result: FoodAnalysisResult | null) {
  if (!result) {
    return {
      vegGrams: '',
      meatGrams: '',
      fruitGrams: '',
      insectGrams: '',
    };
  }

  const { foodType, estimatedWeightGrams } = result;
  const weightStr = estimatedWeightGrams > 0 ? String(estimatedWeightGrams) : '';

  return {
    vegGrams: foodType === 'vegetables' ? weightStr : '',
    meatGrams: foodType === 'meat' ? weightStr : '',
    fruitGrams: foodType === 'fruit' ? weightStr : '',
    insectGrams: foodType === 'insects' ? weightStr : '',
  };
}
