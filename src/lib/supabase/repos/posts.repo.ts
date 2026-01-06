// src/lib/supabase/repos/posts.repo.ts
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '../../supabase';

const BUCKET = 'post-media';

type PostRow = {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  body_md: string;
  species_key: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type PostMediaRow = {
  post_id: string;
  storage_path: string;
  created_at: string;
};

export type PostsFeedItem = {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  body_md: string;
  species_key: string | null;
  created_at: string;

  // enrichment
  author_display_name?: string;
  author_avatar_url?: string | null;
  likes_count?: number;

  // media
  image_url?: string | null;
  image_storage_path?: string | null;
};

// -------------------------
// Helpers
// -------------------------
function extFromUri(uri: string) {
  const clean = uri.split('?')[0];
  const m = clean.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  if (!m) return 'jpg';
  const ext = m[1].toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

function mimeFromExt(ext: string) {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function publicUrlFromStoragePath(storagePath: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Expo/RN 對不同來源的圖片 uri 做 normalize：
 * - file://... ✅ 直接讀
 * - content://... (Android) ✅ 先 copy 到 cacheDirectory 再讀
 * - ph://... (iOS Photos) ⚠️ Expo ImagePicker 通常會給 file://；若你拿到 ph://，這裡會丟錯提醒你
 */
async function normalizeToReadableFileUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;

  if (uri.startsWith('content://')) {
    const ext = extFromUri(uri);
    const target = `${FileSystem.cacheDirectory}upload-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  }

  if (uri.startsWith('ph://')) {
    throw new Error(
      `Unsupported iOS asset uri (ph://). Please ensure ImagePicker returns a file:// uri (use result.assets[0].uri). Got: ${uri}`
    );
  }

  // remote url or other schemes: keep as-is
  return uri;
}

/**
 * 上傳圖片到 Supabase Storage（不用 blob，避免 RN/Hermes blob 不存在）
 * - file/content uri：讀 base64 -> Uint8Array
 * - https url：fetch -> arrayBuffer -> Uint8Array
 */
async function uploadImageToStorage(params: {
  uri: string; // file://... or content://... or https://...
  userId: string;
  postId: string;
}): Promise<{ storage_path: string; public_url: string }> {
  const { uri, userId, postId } = params;

  const normalized = await normalizeToReadableFileUri(uri);

  const ext = extFromUri(normalized);
  const contentType = mimeFromExt(ext);
  const filename = `${Date.now()}.${ext}`;
  const storage_path = `${userId}/${postId}/${filename}`;

  let bytes: Uint8Array;

  if (normalized.startsWith('file://')) {
    const base64 = await FileSystem.readAsStringAsync(normalized, {
      encoding: FileSystem.EncodingType.Base64,
    });
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  } else {
    // remote (https://...)
    const res = await fetch(normalized);
    if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
    const ab = await res.arrayBuffer();
    bytes = new Uint8Array(ab);
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storage_path, bytes, {
    contentType,
    upsert: true,
  });

  if (upErr) throw upErr;

  return { storage_path, public_url: publicUrlFromStoragePath(storage_path) };
}

async function fetchLatestPostMedia(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, PostMediaRow>();

  const { data, error } = await supabase
    .from('post_media')
    .select('post_id, storage_path, created_at')
    .in('post_id', postIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // 因為已排序 created_at desc，所以同 post_id 第一筆即最新
  const map = new Map<string, PostMediaRow>();
  (data ?? []).forEach((r: any) => {
    if (!map.has(r.post_id)) map.set(r.post_id, r as PostMediaRow);
  });
  return map;
}

// -------------------------
// Public APIs
// -------------------------
export async function fetchPostsFeed(params?: {
  limit?: number;
  speciesKey?: string | null;
}): Promise<PostsFeedItem[]> {
  const limit = params?.limit ?? 50;

  let q = supabase
    .from('posts')
    .select('id, author_id, type, title, body_md, species_key, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params?.speciesKey) q = q.eq('species_key', params.speciesKey);

  const { data: posts, error } = await q;
  if (error) throw error;

  const rows = (posts ?? []) as PostRow[];
  if (rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map(r => r.author_id)));
  const postIds = rows.map(r => r.id);

  // profiles（two-step）
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', authorIds);

  if (pErr) console.warn('[fetchPostsFeed] profiles error', pErr);

  const profileMap = new Map<string, ProfileRow>();
  (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p as ProfileRow));

  // likes count（two-step）
  const { data: likesRows, error: lErr } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);

  if (lErr) console.warn('[fetchPostsFeed] likes error', lErr);

  const likeCountMap = new Map<string, number>();
  (likesRows ?? []).forEach((lr: any) => {
    const pid = lr.post_id as string;
    likeCountMap.set(pid, (likeCountMap.get(pid) ?? 0) + 1);
  });

  // media（latest image per post）
  const mediaMap = await fetchLatestPostMedia(postIds);

  return rows.map(r => {
    const prof = profileMap.get(r.author_id);
    const media = mediaMap.get(r.id);

    let image_url: string | null = null;
    let image_storage_path: string | null = null;

    if (media?.storage_path) {
      image_storage_path = media.storage_path;
      image_url = publicUrlFromStoragePath(media.storage_path);
    }

    return {
      ...r,
      author_display_name: prof?.display_name ?? 'New User',
      author_avatar_url: prof?.avatar_url ?? null,
      likes_count: likeCountMap.get(r.id) ?? 0,
      image_url,
      image_storage_path,
    };
  });
}

/**
 * 建立貼文 + 確保圖片上傳到 Storage + 寫入 post_media
 *
 * - imageUri 可為 file:// / content:// / https://
 * - 若 imageUri 沒給，會使用 fallbackUrl（遠端圖）下載後上傳，確保每篇貼文都有圖
 */
export async function createPostWithImage(input: {
  type?: 'general' | 'product' | 'care_tip' | string;
  title?: string | null;
  body_md: string;
  species_key?: string | null;

  imageUri?: string | null; // local file uri OR remote url
  fallbackUrl?: string; // remote url
}): Promise<{ id: string; image_url: string; storage_path: string }> {
  const { data: userRes, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  const user = userRes.user;
  if (!user) throw new Error('Not signed in');

  // 1) insert post
  const payload = {
    author_id: user.id,
    type: input.type ?? 'general',
    title: input.title ?? null,
    body_md: input.body_md,
    species_key: input.species_key ?? null,
  };

  const { data: post, error: postErr } = await supabase
    .from('posts')
    .insert(payload)
    .select('id')
    .single();

  if (postErr) throw postErr;

  const postId = (post as any).id as string;

  // 2) pick image source
  const sourceUri =
    input.imageUri && input.imageUri.trim().length > 0
      ? input.imageUri.trim()
      : input.fallbackUrl ?? 'https://source.unsplash.com/random/900x900/?pet';

  // 3) upload to storage
  const uploaded = await uploadImageToStorage({
    uri: sourceUri,
    userId: user.id,
    postId,
  });

  // 4) insert post_media
  const { error: pmErr } = await supabase.from('post_media').insert({
    post_id: postId,
    storage_path: uploaded.storage_path,
  });

  if (pmErr) throw pmErr;

  return { id: postId, image_url: uploaded.public_url, storage_path: uploaded.storage_path };
}
