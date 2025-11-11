// src/hooks/useTodayHourlyWeatherByCoords.ts
import { useCallback, useEffect, useState } from 'react';
import { ensureTodayHourly } from '../lib/db/services/weather.service'; // ✅ 乾淨的 service 層
import type { Coords } from './useCurrentLocation';

export type TodayHourlyWeatherState = {
  loading: boolean;
  tempHourly: number[];
  uviHourly: number[];
  cloudHourly: number[];
  currentCloud: number | null;
  error?: string;
};

export type UseTodayHourlyWeatherByCoordsOptions = {
  maxAgeHours?: number;
};


export function useTodayHourlyWeatherByCoords(
  coords: Coords | null,
  options: UseTodayHourlyWeatherByCoordsOptions = {}
): TodayHourlyWeatherState & { reload: () => void } {
  const [state, setState] = useState<TodayHourlyWeatherState>({
    loading: false,
    tempHourly: [],
    uviHourly: [],
    cloudHourly: [],
    currentCloud: null,
    error: undefined,
  });

  const maxAgeHours = options.maxAgeHours ?? 2;

  const loadWeather = useCallback(async () => {
    if (!coords) {
      // 沒有座標 → 不打 API，直接維持非 loading 狀態
      setState(prev => ({
        ...prev,
        loading: false,
        tempHourly: [],
        uviHourly: [],
        cloudHourly: [],
        currentCloud: null,
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

      const nowHour = new Date().getHours();

      const tempHourly: number[] = Array.isArray(hourly.temperature)
        ? hourly.temperature
        : [];
      const uviHourly: number[] = Array.isArray(hourly.uvIndex)
        ? hourly.uvIndex
        : [];
      const cloudHourly: number[] = Array.isArray(hourly.cloudcover)
        ? hourly.cloudcover
        : [];

      const currentCloud =
        cloudHourly.length > nowHour ? cloudHourly[nowHour] : null;

      setState({
        loading: false,
        tempHourly,
        uviHourly,
        cloudHourly,
        currentCloud,
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
        error: String(e?.message ?? e),
      });
    }
  }, [coords, maxAgeHours]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  return { ...state, reload: loadWeather };
}

/**
 * 小工具：依雲量百分比做分類
 * 之後你要寫規則（清空度/多雲/陰天）時可以直接用。
 */
export function classifyCloudCover(
  cloudPercent: number | null
): 'clear' | 'partly_cloudy' | 'cloudy' | 'unknown' {
  if (cloudPercent == null || Number.isNaN(cloudPercent)) return 'unknown';
  if (cloudPercent < 30) return 'clear';
  if (cloudPercent < 70) return 'partly_cloudy';
  return 'cloudy';
}
