// src/hooks/useFoodAnalysis.ts
import { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";

import { useImagePicker } from "../lib/ui/useImagePicker";
import {
  analyzeFoodViaSupabase,
  type FoodAnalysisResult,
} from "../lib/ai/foodAnalysis.service";
import {
  generateNutritionalSuggestion,
  type NutritionalSuggestion,
} from "../lib/compliance/nutritionalSuggestion.service";

// ========== 類型定義 ==========

export type FoodAnalysisState = {
  analyzing: boolean;
  result: FoodAnalysisResult | null;
  suggestion: NutritionalSuggestion | null;
  error: string | null;
  imageUri: string | null;
  hasApiKey: boolean; // 保留欄位給 UI 用，但改成「服務是否可用」
};

export type UseFoodAnalysisReturn = {
  state: FoodAnalysisState;
  analyzeFromCamera: () => Promise<void>;
  analyzeFromLibrary: () => Promise<void>;
  clearResult: () => void;
  checkApiKey: () => Promise<boolean>;
};

const initialState: FoodAnalysisState = {
  analyzing: false,
  result: null,
  suggestion: null,
  error: null,
  imageUri: null,
  hasApiKey: true, // Supabase 版：不需要 app 端 key，預設可用
};

export function useFoodAnalysis(petId: string | null): UseFoodAnalysisReturn {
  const [state, setState] = useState<FoodAnalysisState>(initialState);
  const { pickFromLibrary, takePhoto } = useImagePicker();
  const analysisIdRef = useRef(0);

  const checkApiKey = useCallback(async () => {
    // Supabase 版不需要 Gemini Key（key 在 edge function secrets）
    setState((prev) => ({ ...prev, hasApiKey: true }));
    return true;
  }, []);

  const performAnalysis = useCallback(
    async (imageUri: string | null) => {
      if (!imageUri) return;

      const currentId = ++analysisIdRef.current;

      setState((prev) => ({
        ...prev,
        analyzing: true,
        error: null,
        imageUri,
        result: null,
        suggestion: null,
        hasApiKey: true,
      }));

      try {
        const { result } = await analyzeFoodViaSupabase(imageUri);

        if (currentId !== analysisIdRef.current) return;

        let suggestion: NutritionalSuggestion | null = null;
        if (petId) {
          try {
            suggestion = await generateNutritionalSuggestion(petId, result);
          } catch (e) {
            console.warn("[useFoodAnalysis] suggestion failed:", e);
          }
        }

        setState((prev) => ({
          ...prev,
          analyzing: false,
          result,
          suggestion,
          error: null,
        }));
      } catch (e: any) {
        if (currentId !== analysisIdRef.current) return;

        const msg = e?.message ?? "分析失敗，請稍後再試";
        setState((prev) => ({
          ...prev,
          analyzing: false,
          result: null,
          suggestion: null,
          error: msg,
        }));
        Alert.alert("分析失敗", msg);
      }
    },
    [petId],
  );

  const analyzeFromCamera = useCallback(async () => {
    try {
      const uri = await takePhoto();
      await performAnalysis(uri);
    } catch (e) {
      console.error("[useFoodAnalysis] camera error:", e);
      Alert.alert("錯誤", "無法開啟相機");
    }
  }, [takePhoto, performAnalysis]);

  const analyzeFromLibrary = useCallback(async () => {
    try {
      const uri = await pickFromLibrary();
      await performAnalysis(uri);
    } catch (e) {
      console.error("[useFoodAnalysis] library error:", e);
      Alert.alert("錯誤", "無法開啟相簿");
    }
  }, [pickFromLibrary, performAnalysis]);

  const clearResult = useCallback(() => {
    setState((prev) => ({
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
