// src/lib/db/services/weather.service.ts
import { query, execute } from '../db.client';

export type CachedHourly = {
  temperature: number[];
  cloudcover: number[];
  uvIndex: number[];
  uviMax: number | null;
  tz?: string | null;
};

export type EnsureResult = {
  locationKey: string;
  date: string;
  /** 這裡的 hourly.* 都是「從現在起往後 24 小時」的序列 */
  hourly: CachedHourly;
};

type WeatherHourly = {
  tz: string;
  lat: number;
  lon: number;
  temperature: number[];
  cloudcover: number[];
  uvIndex: number[];
  uviMax: number | null;
  date: string;
  locationKey: string;
  raw: any;
};

function toKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function todayYYYYMMDD() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * 直接呼叫 Open-Meteo API 取得逐小時資料，並切出
 * 「從現在起往後 24 小時」。
 *
 * - 不做 DB cache、不知道 maxAge
 * - 回傳的 temperature/cloudcover/uvIndex 長度最多為 24
 */
export async function fetchHourlyFromAPI(
  lat: number,
  lon: number
): Promise<WeatherHourly> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,cloudcover,uv_index',
    timezone: 'auto',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const json = await res.json();

  const tz = json.timezone ?? 'UTC';
  const times: string[] = json.hourly?.time ?? [];
  const temperatureAll: number[] = json.hourly?.temperature_2m ?? [];
  const cloudcoverAll: number[] = json.hourly?.cloudcover ?? [];
  const uvIndexAll: number[] = json.hourly?.uv_index ?? [];

  // 依 API 給的時間列，找出「最接近現在」的 index，往後取 24 小時
  const now = Date.now();
  // 找最後一個 <= now 的時間點當作起點（或 0）
  let idx = -1;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    if (t <= now) idx = i;
    else break;
  }
  const startIdx = Math.max(0, idx);
  const END = startIdx + 24;

  const temperature = temperatureAll.slice(startIdx, END);
  const cloudcover = cloudcoverAll.slice(startIdx, END);
  const uvIndex = uvIndexAll.slice(startIdx, END);

  const uviMax = uvIndex.length ? Math.max(...uvIndex) : null;

  return {
    tz,
    lat,
    lon,
    temperature,
    cloudcover,
    uvIndex,
    uviMax,
    date: todayYYYYMMDD(),
    locationKey: toKey(lat, lon),
    raw: json, // 保留完整原始回應以備除錯
  };
}

/**
 * 將一筆 WeatherHourly 寫入 / 更新到 weather_cache
 */
export async function upsertWeatherCache(row: WeatherHourly): Promise<void> {
  const nowIso = new Date().toISOString();
  await execute(
    `INSERT INTO weather_cache
      (location_key, date, tz, lat, lon, uvi_max,
       hourly_temp_c_json, hourly_cloudcover_json, hourly_uv_index_json,
       raw_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(location_key, date) DO UPDATE SET
       tz = excluded.tz,
       lat = excluded.lat,
       lon = excluded.lon,
       uvi_max = excluded.uvi_max,
       hourly_temp_c_json = excluded.hourly_temp_c_json,
       hourly_cloudcover_json = excluded.hourly_cloudcover_json,
       hourly_uv_index_json = excluded.hourly_uv_index_json,
       raw_json = excluded.raw_json,
       updated_at = excluded.updated_at`,
    [
      row.locationKey,
      row.date,
      row.tz,
      row.lat,
      row.lon,
      row.uviMax,
      JSON.stringify(row.temperature),
      JSON.stringify(row.cloudcover),
      JSON.stringify(row.uvIndex),
      JSON.stringify(row.raw),
      nowIso,
      nowIso,
    ]
  );
}

/**
 * 從 weather_cache 讀出一筆指定 locationKey + date 的逐小時資料
 */
export async function getCachedHourly(
  locationKey: string,
  dateStr: string
): Promise<CachedHourly | null> {
  const rows = await query<{
    hourly_temp_c_json: string;
    hourly_cloudcover_json: string;
    hourly_uv_index_json: string;
    uvi_max: number | null;
    tz: string | null;
  }>(
    `SELECT hourly_temp_c_json, hourly_cloudcover_json,
            hourly_uv_index_json, uvi_max, tz
     FROM weather_cache
     WHERE location_key = ? AND date = ?
     LIMIT 1`,
    [locationKey, dateStr]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    temperature: JSON.parse(r.hourly_temp_c_json || '[]'),
    cloudcover: JSON.parse(r.hourly_cloudcover_json || '[]'),
    uvIndex: JSON.parse(r.hourly_uv_index_json || '[]'),
    uviMax: r.uvi_max ?? null,
    tz: r.tz,
  };
}

/**
 * ✅ 單一入口：依 lat/lon 確保「接下來 24 小時」逐小時天氣資料存在
 *
 * 呼叫者要自己決定 coords 來源（例如用 useCurrentLocation hook），
 * 這裡只負責：
 * - 檢查 cache 是否存在 / 是否過期
 * - 視情況重抓並更新 weather_cache
 * - 回傳的 hourly.* 一律視為「從現在起往後 24 小時」的序列
 */
export async function ensureTodayHourly(options: {
  lat: number;
  lon: number;
  maxAgeHours?: number;
}): Promise<EnsureResult> {
  const { lat, lon, maxAgeHours } = options;

  const locationKey = toKey(lat, lon);
  const date = todayYYYYMMDD();

  const maxAge = maxAgeHours ?? null;

  // 有設定 maxAgeHours 的情況下，先檢查 updated_at
  if (maxAge != null) {
    const freshRows = await query<{ updated_at: string }>(
      `SELECT updated_at FROM weather_cache WHERE location_key = ? AND date = ? LIMIT 1`,
      [locationKey, date]
    );
    if (freshRows.length > 0) {
      const updatedAt = new Date(freshRows[0].updated_at).getTime();
      const ageHours = (Date.now() - updatedAt) / 36e5;
      if (ageHours <= maxAge) {
        const cached = await getCachedHourly(locationKey, date);
        if (cached && cached.temperature.length) {
          return { locationKey, date, hourly: cached };
        }
      }
    }
  } else {
    // 沒有年齡限制：只要今天有 cache 就直接用
    const cached = await getCachedHourly(locationKey, date);
    if (cached && cached.temperature.length) {
      return { locationKey, date, hourly: cached };
    }
  }

  // cache 不存在或太舊 → 打 API + upsert
  const fresh = await fetchHourlyFromAPI(lat, lon);
  await upsertWeatherCache(fresh);

  const hourly = await getCachedHourly(locationKey, date);
  if (!hourly) throw new Error('weather_cache upsert failed');

  return { locationKey, date, hourly };
}
