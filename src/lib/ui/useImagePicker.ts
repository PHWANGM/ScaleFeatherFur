// src/lib/ui/useImagePicker.ts
import { useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';

/** 簡化使用：回傳選到的圖片 URI（取消/沒權限則回 null） */
export function useImagePicker() {
  const pickFromLibrary = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled) return null;
    return res.assets?.[0]?.uri ?? null;
  }, []);

  const takePhoto = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;

    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled) return null;
    return res.assets?.[0]?.uri ?? null;
  }, []);

  return { pickFromLibrary, takePhoto };
}
