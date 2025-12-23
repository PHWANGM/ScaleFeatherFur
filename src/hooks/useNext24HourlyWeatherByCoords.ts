// src/hooks/useNext24HourlyWeatherByCoords.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** ✅ 每次 App 回前景 +1；同一個 session 只抓一次天氣 */
  sessionId?: number;
};

/** ✅ in-memory cache：同一 session、同一座標只抓一次 */
type CachedWeather = {
  sessionId: number;
  fetchedAt: number;
  payload: Omit<
    Next24HourlyWeatherState,
    'loading' | 'tempRisk' | 'uvbRisk' | 'error'
  >;
};

const weatherCache = new Map<string, CachedWeather>();

const round2 = (n: number) => Math.round(n * 100) / 100;
const makeKey = (coords: Coords, maxAgeHours: number) =>
  `${round2(coords.latitude)}:${round2(coords.longitude)}:age=${maxAgeHours}`;

const emptyBase = {
  tempHourly: [],
  uviHourly: [],
  cloudHourly: [],
  timesLocal: [],
  currentCloud: null,
  next24Temp: [],
  next24Uvi: [],
  next24TimesLocal: [],
};

export function useNext24HourlyWeatherByCoords(
  coords: Coords | null,
  petId: string | null,
  options: UseNext24HourlyWeatherByCoordsOptions = {}
): Next24HourlyWeatherState & { reload: () => void } {
  const maxAgeHours = options.maxAgeHours ?? 2;
  const sessionId = options.sessionId ?? 1;

  const [state, setState] = useState<Next24HourlyWeatherState>({
    loading: false,
    ...emptyBase,
    tempRisk: null,
    uvbRisk: null,
    error: undefined,
  });

  // 用來強制重抓（reload）
  const [forceTick, setForceTick] = useState(0);

  const key = useMemo(() => {
    if (!coords) return null;
    return makeKey(coords, maxAgeHours);
  }, [coords, maxAgeHours]);

  const loadWeather = useCallback(async (force = false) => {
    if (!coords || !key) {
      setState((prev) => ({
        ...prev,
        loading: false,
        ...emptyBase,
        tempRisk: null,
        uvbRisk: null,
        error: undefined,
      }));
      return;
    }

    // ✅ 同一 session 命中 cache：不重抓
    if (!force) {
      const cached = weatherCache.get(key);
      if (cached && cached.sessionId === sessionId) {
        setState((prev) => ({
          ...prev,
          loading: false,
          ...cached.payload,
          error: undefined,
          // tempRisk/uvbRisk 由下面另一個 effect 重新計算
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: undefined }));

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

      const currentCloud = cloudHourly.length > 0 ? cloudHourly[0] : null;

      const payload: CachedWeather['payload'] = {
        tempHourly,
        uviHourly,
        cloudHourly,
        timesLocal,
        currentCloud,
        next24Temp,
        next24Uvi,
        next24TimesLocal,
      };

      // ✅ 更新 cache（同一 session 之後不再抓）
      weatherCache.set(key, {
        sessionId,
        fetchedAt: Date.now(),
        payload,
      });

      setState((prev) => ({
        ...prev,
        loading: false,
        ...payload,
        error: undefined,
        // tempRisk/uvbRisk 由下面另一個 effect 重新計算
      }));
    } catch (e: any) {
      console.warn('weather load error:', e?.message ?? e);
      setState((prev) => ({
        ...prev,
        loading: false,
        ...emptyBase,
        tempRisk: null,
        uvbRisk: null,
        error: String(e?.message ?? e),
      }));
    }
  }, [coords, key, maxAgeHours, sessionId]);

  // ✅ 只在 sessionId 改變（= 回前景/重新打開）或 coords 改變時抓一次
  useEffect(() => {
    loadWeather(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, key, forceTick]);

  // ✅ 風險計算拆出去：petId 變，只重算風險，不重抓天氣
  const riskJobIdRef = useRef(0);
  useEffect(() => {
    const jobId = ++riskJobIdRef.current;

    const run = async () => {
      const next24Temp = state.next24Temp;
      const next24Uvi = state.next24Uvi;
      const next24TimesLocal = state.next24TimesLocal;

      if (!petId || next24TimesLocal.length === 0) {
        setState((prev) => ({
          ...prev,
          tempRisk: null,
          uvbRisk: null,
        }));
        return;
      }

      try {
        let tempRisk: Next24hTempRiskResult | null = null;
        let uvbRisk: Next24hUvbRiskResult | null = null;

        if (next24Temp.length > 0) {
          tempRisk = await evaluateNext24hAmbientTempForPetFromTodayHourly(
            petId,
            next24Temp,
            next24TimesLocal
          );
        }
        if (next24Uvi.length > 0) {
          uvbRisk = await evaluateNext24hUvbForPetFromTodayHourly(
            petId,
            next24Uvi,
            next24TimesLocal
          );
        }

        // ✅ 避免過期 job 回寫
        if (riskJobIdRef.current !== jobId) return;

        setState((prev) => ({
          ...prev,
          tempRisk,
          uvbRisk,
        }));
      } catch (e: any) {
        if (riskJobIdRef.current !== jobId) return;
        console.warn('risk calc error:', e?.message ?? e);
        // 風險算失敗不清空天氣，只把 risk 設 null 並保留 error
        setState((prev) => ({
          ...prev,
          tempRisk: null,
          uvbRisk: null,
          error: prev.error ?? String(e?.message ?? e),
        }));
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    petId,
    state.next24Temp,
    state.next24Uvi,
    state.next24TimesLocal,
  ]);

  const reload = useCallback(() => {
    // ✅ 強制重抓一次（忽略 session cache）
    setForceTick((t) => t + 1);
    // 下一輪 effect 會跑 loadWeather(false)，但我們要強制
    // 所以直接在這裡呼叫 force=true
    loadWeather(true);
  }, [loadWeather]);

  return { ...state, reload };
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
