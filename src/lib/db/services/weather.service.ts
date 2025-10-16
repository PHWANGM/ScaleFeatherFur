// src/lib/weather.service.ts
import * as Location from 'expo-location';
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

export async function getCurrentCoords(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    // fallback: 台北車站；可改為上次成功定位
    return { lat: 25.0478, lon: 121.5170 };
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export async function fetchHourlyFromAPI(lat: number, lon: number): Promise<WeatherHourly> {
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
  const cloudcoverAll: number[]  = json.hourly?.cloudcover ?? [];
  const uvIndexAll: number[]     = json.hourly?.uv_index ?? [];

  // 以 API 給的時間列，找出 <= 現在 的第一個 index
  const now = Date.now();
  const startIdx = Math.max(
    0,
    times.findIndex((iso) => new Date(iso).getTime() <= now)
  );
  const END = startIdx + 24; // 只要未來 48 小時

  const temperature = temperatureAll.slice(startIdx, END);
  const cloudcover  = cloudcoverAll.slice(startIdx, END);
  const uvIndex     = uvIndexAll.slice(startIdx, END);

  const uviMax = uvIndex.length ? Math.max(...uvIndex) : null;

  return {
    tz, lat, lon,
    temperature, cloudcover, uvIndex, uviMax,
    date: todayYYYYMMDD(),
    locationKey: toKey(lat, lon),
    raw: json, // 保留完整原始回應以備除錯
  };
}

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

export async function getCachedHourly(locationKey: string, dateStr: string): Promise<CachedHourly | null> {
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
    cloudcover:  JSON.parse(r.hourly_cloudcover_json || '[]'),
    uvIndex:     JSON.parse(r.hourly_uv_index_json || '[]'),
    uviMax: r.uvi_max ?? null,
    tz: r.tz,
  };
}

/** 主要入口：確保「今天」逐小時資料 */
export async function ensureTodayHourly(options?: { maxAgeHours?: number }): Promise<EnsureResult> {
  const { lat, lon } = await getCurrentCoords();
  const locationKey = toKey(lat, lon);
  const date = todayYYYYMMDD();

  const maxAge = options?.maxAgeHours ?? null;
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
    const cached = await getCachedHourly(locationKey, date);
    if (cached && cached.temperature.length) {
      return { locationKey, date, hourly: cached };
    }
  }

  const fresh = await fetchHourlyFromAPI(lat, lon);
  await upsertWeatherCache(fresh);
  const hourly = await getCachedHourly(locationKey, date);
  if (!hourly) throw new Error('weather_cache upsert failed');
  return { locationKey, date, hourly };
}

export async function ensureTodayWithCurrentCloud(): Promise<EnsureResult & { currentCloudPct: number | null }> {
  const base = await ensureTodayHourly();
  const hr = new Date().getHours();
  const currentCloudPct =
    Array.isArray(base.hourly.cloudcover) && base.hourly.cloudcover.length > hr
      ? base.hourly.cloudcover[hr]
      : null;
  return { ...base, currentCloudPct };
}
