// src/lib/utils/imageUtils.ts
// 使用 legacy API 以確保相容性
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 將本地 file:// URI 轉換為 Base64 字串
 * @param uri 本地檔案 URI (file://...)
 * @returns Base64 編碼的圖片資料（不含 data:image/... 前綴）
 */
export async function fileUriToBase64(uri: string): Promise<string> {
  try {
    console.log('[imageUtils] Reading file:', uri);

    // 確認檔案存在
    const fileInfo = await FileSystem.getInfoAsync(uri);
    console.log('[imageUtils] File info:', JSON.stringify(fileInfo));

    if (!fileInfo.exists) {
      throw new Error('FILE_NOT_FOUND');
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[imageUtils] Base64 length:', base64.length);
    return base64;
  } catch (err: any) {
    console.error('[imageUtils] Failed to convert file to base64:', err);
    throw new Error('IMAGE_READ_ERROR');
  }
}

/**
 * 根據 URI 副檔名推斷 MIME 類型
 * @param uri 檔案 URI
 * @returns MIME 類型字串
 */
export function getMimeTypeFromUri(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase() ?? '';

  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };

  return mimeTypes[extension] ?? 'image/jpeg'; // 預設為 JPEG
}

/**
 * 取得檔案大小（位元組）
 * @param uri 本地檔案 URI
 * @returns 檔案大小（bytes），若無法取得則返回 null
 */
export async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    console.log('[imageUtils] getFileSize info:', JSON.stringify(info));
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      return info.size;
    }
    return null;
  } catch (err) {
    console.error('[imageUtils] getFileSize error:', err);
    return null;
  }
}

/**
 * 驗證圖片大小是否在限制內
 * @param uri 本地檔案 URI
 * @param maxSizeBytes 最大允許大小（預設 4MB）
 * @returns 是否在限制內
 */
export async function validateImageSize(
  uri: string,
  maxSizeBytes: number = 4 * 1024 * 1024
): Promise<{ valid: boolean; size: number | null; maxSize: number }> {
  const size = await getFileSize(uri);
  return {
    valid: size !== null && size <= maxSizeBytes,
    size,
    maxSize: maxSizeBytes,
  };
}

// ========== 圖片壓縮 ==========

export type CompressOptions = {
  /** 最大寬度（預設 1024） */
  maxWidth?: number;
  /** 最大高度（預設 1024） */
  maxHeight?: number;
  /** 壓縮品質 0-1（預設 0.7） */
  quality?: number;
  /** 目標最大檔案大小（bytes，預設 1MB） */
  targetMaxBytes?: number;
};

const DEFAULT_COMPRESS_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.7,
  targetMaxBytes: 1 * 1024 * 1024, // 1MB
};

/**
 * 壓縮圖片以符合 API 上傳限制
 * @param uri 原始圖片 URI
 * @param options 壓縮選項
 * @returns 壓縮後的圖片 URI
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_COMPRESS_OPTIONS, ...options };

  console.log('[imageUtils] Starting compression for:', uri);

  try {
    // 第一次壓縮：調整尺寸和品質
    let result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: opts.maxWidth, height: opts.maxHeight } }],
      {
        compress: opts.quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    console.log('[imageUtils] First compression result:', result.uri);

    // 檢查壓縮後的大小
    let size = await getFileSize(result.uri);

    // 如果仍然過大，逐步降低品質
    let currentQuality = opts.quality;
    const minQuality = 0.3;

    while (size && size > opts.targetMaxBytes && currentQuality > minQuality) {
      currentQuality -= 0.1;

      result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: opts.maxWidth, height: opts.maxHeight } }],
        {
          compress: currentQuality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      size = await getFileSize(result.uri);
      console.log(`[imageUtils] Compressed with quality ${currentQuality.toFixed(1)}, size: ${formatBytes(size ?? 0)}`);
    }

    // 如果品質降到最低仍然過大，進一步縮小尺寸
    if (size && size > opts.targetMaxBytes) {
      const smallerWidth = Math.round(opts.maxWidth * 0.6);
      const smallerHeight = Math.round(opts.maxHeight * 0.6);

      result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: smallerWidth, height: smallerHeight } }],
        {
          compress: minQuality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      size = await getFileSize(result.uri);
      console.log(`[imageUtils] Further resized to ${smallerWidth}x${smallerHeight}, size: ${formatBytes(size ?? 0)}`);
    }

    console.log(`[imageUtils] Final compressed size: ${formatBytes(size ?? 0)}`);
    return result.uri;
  } catch (err) {
    console.error('[imageUtils] Compression failed:', err);
    // 壓縮失敗時返回原始 URI
    return uri;
  }
}

/**
 * 壓縮圖片並轉換為 Base64
 * @param uri 原始圖片 URI
 * @param options 壓縮選項
 * @returns Base64 編碼的圖片資料
 */
export async function compressAndConvertToBase64(
  uri: string,
  options: CompressOptions = {}
): Promise<{ base64: string; compressedUri: string }> {
  const compressedUri = await compressImage(uri, options);
  const base64 = await fileUriToBase64(compressedUri);
  return { base64, compressedUri };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
