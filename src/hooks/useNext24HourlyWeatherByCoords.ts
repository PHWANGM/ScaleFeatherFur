// src/hooks/useNext24HourlyWeatherByCoords.ts
import { useCallback, useEffect, useState } from 'react';
import { ensureTodayHourly } from '../lib/db/services/weather.service';
import type { Coords } from './useCurrentLocation';
import {
  evaluateNext24hAmbientTempForPetFromTodayHourly,
  type Next24hTempRiskResult,
} from '../lib/compliance/envTempForecast.service';
import {
  evaluateNext24hUvbForPetFromTodayHourly,
  type Next24hUvbRiskResult,
} from '../lib/compliance/uvbForecast.service';

export type Next24HourlyWeatherState = {
  loading: boolean;

  /** API + cache 回來的「接下來 24 小時」溫度 / UVI / 雲量序列 */
  tempHourly: number[];
  uviHourly: number[];
  cloudHourly: number[];
  /** 與 tempHourly 對齊的當地時間 ISO 字串（含 offset） */
  timesLocal: string[];
  currentCloud: number | null;

  /** 從現在開始的 24 小時溫度（通常等於 tempHourly） */
  next24Temp: number[];
  /** 從現在開始的 24 小時 UVI（通常等於 uviHourly） */
  next24Uvi: number[];
  /** 從現在開始的 24 小時當地時間（通常等於 timesLocal） */
  next24TimesLocal: string[];

  /** 和 species ambient 溫度 target 比較後的結果；若沒有 petId 或沒有 target 就是 null */
  tempRisk: Next24hTempRiskResult | null;
  /** 和 species UVB intensity (uvb_intensity_min/max) 比較後的結果；若沒有 petId 或沒有 target 就是 null */
  uvbRisk: Next24hUvbRiskResult | null;

  error?: string;
};

export type UseNext24HourlyWeatherByCoordsOptions = {
  maxAgeHours?: number;
};

/**
 * 1) 用 coords 取得「接下來 24 小時」的 hourly 天氣。
 * 2) 直接把這 24h 溫度 / UVI 拿去跟該 pet 的 species target 比較：
 *    - ambient_temp_c_min / max → tempRisk
 *    - uvb_intensity_min / max  → uvbRisk（以 uviHourly 為輸入）
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
    timesLocal: [],
    currentCloud: null,
    next24Temp: [],
    next24Uvi: [],
    next24TimesLocal: [],
    tempRisk: null,
    uvbRisk: null,
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
        timesLocal: [],
        currentCloud: null,
        next24Temp: [],
        next24Uvi: [],
        next24TimesLocal: [],
        tempRisk: null,
        uvbRisk: null,
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

      const tempHourly: number[] = Array.isArray(hourly.temperature)
        ? hourly.temperature
        : [];
      const uviHourly: number[] = Array.isArray(hourly.uvIndex)
        ? hourly.uvIndex
        : [];
      const cloudHourly: number[] = Array.isArray(hourly.cloudcover)
        ? hourly.cloudcover
        : [];
      const timesLocal: string[] = Array.isArray((hourly as any).timesLocal)
        ? (hourly as any).timesLocal
        : [];

      // 這裡的陣列已經代表「從現在起往後 24 小時」
      const next24Temp = tempHourly.slice(0, 24);
      const next24Uvi = uviHourly.slice(0, 24);
      const next24TimesLocal = timesLocal.slice(0, 24);

      // 目前的雲量就抓第 0 小時（最接近現在）
      const currentCloud = cloudHourly.length > 0 ? cloudHourly[0] : null;

      let tempRisk: Next24hTempRiskResult | null = null;
      let uvbRisk: Next24hUvbRiskResult | null = null;

      if (petId && next24Temp.length > 0) {
        tempRisk = await evaluateNext24hAmbientTempForPetFromTodayHourly(
          petId,
          next24Temp,
          next24TimesLocal
        );
      }

      if (petId && next24Uvi.length > 0) {
        uvbRisk = await evaluateNext24hUvbForPetFromTodayHourly(
          petId,
          next24Uvi,
          next24TimesLocal
        );
      }

      setState({
        loading: false,
        tempHourly,
        uviHourly,
        cloudHourly,
        timesLocal,
        currentCloud,
        next24Temp,
        next24Uvi,
        next24TimesLocal,
        tempRisk,
        uvbRisk,
        error: undefined,
      });
    } catch (e: any) {
      console.warn('weather load error:', e?.message ?? e);
      setState({
        loading: false,
        tempHourly: [],
        uviHourly: [],
        cloudHourly: [],
        timesLocal: [],
        currentCloud: null,
        next24Temp: [],
        next24Uvi: [],
        next24TimesLocal: [],
        tempRisk: null,
        uvbRisk: null,
        error: String(e?.message ?? e),
      });
    }
  }, [coords, maxAgeHours, petId]);

  useEffect(() => {
    loadWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
