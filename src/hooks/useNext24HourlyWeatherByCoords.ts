// src/hooks/useNext24HourlyWeatherByCoords.ts
import { useCallback, useEffect, useState } from 'react';
import { ensureTodayHourly } from '../lib/db/services/weather.service';
import type { Coords } from './useCurrentLocation';

import {
  evaluateNext24hAmbientTempForPetFromTodayHourly,
  type Next24hTempRiskResult,
} from '../lib/compliance/envTempForecast.service';

export type Next24HourlyWeatherState = {
  loading: boolean;

  /** API + cache 回來的「接下來 24 小時」溫度序列 */
  tempHourly: number[];
  uviHourly: number[];
  cloudHourly: number[];
  currentCloud: number | null;

  /** 從現在開始的 24 小時溫度（通常等於 tempHourly） */
  next24Temp: number[];

  /** 和 species target 比較後的結果；若沒有 petId 或沒有 target 就是 null */
  tempRisk: Next24hTempRiskResult | null;

  error?: string;
};

export type UseNext24HourlyWeatherByCoordsOptions = {
  maxAgeHours?: number;
};

/**
 * 1) 用 coords 取得「接下來 24 小時」的 hourly 天氣。
 * 2) 直接把這 24h 溫度拿去跟該 pet 的 species ambient 溫度需求比較。
 */
export function useNext24HourlyWeatherByCoords(
  coords: Coords | null,
  petId: string | null,
  options: UseNext24HourlyWeatherByCoordsOptions = {}
): Next24HourlyWeatherState & { reload: () => void } {
  const [state, setState] = useState<Next24HourlyWeatherState>({
    loading: false,
    tempHourly: [],
    uviHourly: [],
    cloudHourly: [],
    currentCloud: null,
    next24Temp: [],
    tempRisk: null,
    error: undefined,
  });

  const maxAgeHours = options.maxAgeHours ?? 2;

  const loadWeather = useCallback(async () => {
    if (!coords) {
      setState(prev => ({
        ...prev,
        loading: false,
        tempHourly: [],
        uviHourly: [],
        cloudHourly: [],
        currentCloud: null,
        next24Temp: [],
        tempRisk: null,
        error: undefined,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const { hourly } = await ensureTodayHourly({
        lat: coords.latitude,
        lon: coords.longitude,
        maxAgeHours,
      });

      const now = new Date();

      const tempHourly: number[] = Array.isArray(hourly.temperature)
        ? hourly.temperature
        : [];
      const uviHourly: number[] = Array.isArray(hourly.uvIndex)
        ? hourly.uvIndex
        : [];
      const cloudHourly: number[] = Array.isArray(hourly.cloudcover)
        ? hourly.cloudcover
        : [];

      // 這裡的陣列已經代表「從現在起往後 24 小時」
      const next24Temp = tempHourly.slice(0, 24);

      // 目前的雲量就抓第 0 小時（最接近現在）
      const currentCloud = cloudHourly.length > 0 ? cloudHourly[0] : null;

      let tempRisk: Next24hTempRiskResult | null = null;

      if (petId && next24Temp.length > 0) {
        tempRisk = await evaluateNext24hAmbientTempForPetFromTodayHourly(
          petId,
          next24Temp,
          now
        );
      }

      setState({
        loading: false,
        tempHourly,
        uviHourly,
        cloudHourly,
        currentCloud,
        next24Temp,
        tempRisk,
        error: undefined,
      });
    } catch (e: any) {
      console.warn('weather load error:', e?.message ?? e);
      setState({
        loading: false,
        tempHourly: [],
        uviHourly: [],
        cloudHourly: [],
        currentCloud: null,
        next24Temp: [],
        tempRisk: null,
        error: String(e?.message ?? e),
      });
    }
  }, [coords, maxAgeHours, petId]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  return { ...state, reload: loadWeather };
}

/**
 * 小工具：依雲量百分比做分類
 */
export function classifyCloudCover(
  cloudPercent: number | null
): 'clear' | 'partly_cloudy' | 'cloudy' | 'unknown' {
  if (cloudPercent == null || Number.isNaN(cloudPercent)) return 'unknown';
  if (cloudPercent < 30) return 'clear';
  if (cloudPercent < 70) return 'partly_cloudy';
  return 'cloudy';
}
