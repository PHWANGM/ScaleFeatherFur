// src/hooks/useCurrentLocation.ts
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type Coords = {
  latitude: number;
  longitude: number;
};

export type UseCurrentLocationState = {
  coords: Coords | null;
  locationName: string;
  loading: boolean;
  error?: string;
};

export function useCurrentLocation(): UseCurrentLocationState & { reload: () => void } {
  const [state, setState] = useState<UseCurrentLocationState>({
    coords: null,
    locationName: 'Locating…',
    loading: false,
    error: undefined,
  });

  const load = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: undefined }));

      // 1️⃣ 先要權限
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('location permission status:', status);

      if (status !== 'granted') {
        setState({
          coords: null,
          locationName: 'Permission denied',
          loading: false,
          error: 'Location permission denied',
        });
        return;
      }

      // 2️⃣ 拿目前位置（有加 log + fallback）
      let pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(async (err) => {
        console.warn('getCurrentPositionAsync failed, try last known:', err);
        return await Location.getLastKnownPositionAsync();
      });

      if (!pos) {
        throw new Error('Current location unavailable and no cached position.');
      }

      const coords: Coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      console.log('coords:', coords);

      // 3️⃣ 反向地理編碼
      let locationName = 'Unknown';
      try {
        const [place] = await Location.reverseGeocodeAsync(coords);
        console.log('reverseGeocode result:', place);

        if (place) {
          const city = place.city || place.subregion || '';
          const region = place.region || '';
          const country = place.country || '';
          locationName =
            [city, region || country].filter(Boolean).join(', ') || 'Unknown';
        }
      } catch (e) {
        console.warn('reverseGeocode error:', e);
      }

      setState({
        coords,
        locationName,
        loading: false,
        error: undefined,
      });
    } catch (e: any) {
      console.warn('location error:', e);
      setState({
        coords: null,
        locationName: 'Unknown',
        loading: false,
        error: String(e?.message ?? e),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
