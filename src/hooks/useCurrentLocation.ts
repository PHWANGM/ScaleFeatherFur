import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

export type UseCurrentLocationState = {
  coords: Coords | null;
  locationName: string;
  loading: boolean;
  error?: string;
};

// ✅ in-memory cache：即使 HomeScreen 被 unmount/remount，也不會重抓
let cached: { sessionId: number; state: UseCurrentLocationState } | null = null;

type Options = { sessionId?: number };

export function useCurrentLocation(
  options?: Options
): UseCurrentLocationState & { reload: () => void } {
  const sessionId = options?.sessionId ?? 1;

  const [state, setState] = useState<UseCurrentLocationState>(() => {
    if (cached && cached.sessionId === sessionId) return cached.state;
    return {
      coords: null,
      locationName: 'Locating…',
      loading: false,
      error: undefined,
    };
  });

  const load = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const next = {
          coords: null,
          locationName: 'Permission denied',
          loading: false,
          error: 'Location permission denied',
        };
        cached = { sessionId, state: next };
        setState(next);
        return;
      }

      let pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(async () => {
        return await Location.getLastKnownPositionAsync();
      });

      if (!pos) throw new Error('Current location unavailable and no cached position.');

      const coords: Coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      let locationName = 'Unknown';
      try {
        const [place] = await Location.reverseGeocodeAsync(coords);
        if (place) {
          const city = place.city || place.subregion || '';
          const region = place.region || '';
          const country = place.country || '';
          locationName = [city, region || country].filter(Boolean).join(', ') || 'Unknown';
        }
      } catch {}

      const next: UseCurrentLocationState = {
        coords,
        locationName,
        loading: false,
        error: undefined,
      };

      cached = { sessionId, state: next };
      setState(next);
    } catch (e: any) {
      const next: UseCurrentLocationState = {
        coords: null,
        locationName: 'Unknown',
        loading: false,
        error: String(e?.message ?? e),
      };
      cached = { sessionId, state: next };
      setState(next);
    }
  }, [sessionId]);

  // ✅ 只有 sessionId 改變（= 每次打開 app / 回前景）才 reload
  useEffect(() => {
    if (cached && cached.sessionId === sessionId) return;
    load();
  }, [sessionId, load]);

  return { ...state, reload: load };
}
