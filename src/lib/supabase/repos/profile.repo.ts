// src/lib/supabase/repos/profile.repo.ts
import { supabase } from '../../supabase'; // ✅ 依你的專案調整：如果你是 ../supabase 就改成 '../supabase'

export type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  location_city?: string | null;
};

export type MembershipRow = {
  user_id: string;
  is_premium: boolean;
  plan: string;
  expires_at?: string | null;
};

export type ProfileSummary = {
  userId: string | null;
  profile: ProfileRow | null;
  postCount: number;
  friendCount: number;
  membership: MembershipRow | null;
};

export async function getAuthedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function fetchProfileById(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, location_city')
    .eq('id', userId)
    .single();

  if (error) return null;
  return data as ProfileRow;
}

export async function fetchMyPostCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', userId);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchMyFriendCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friendships')
    .select('user_a', { count: 'exact', head: true })
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (error) return 0;
  return count ?? 0;
}

export async function fetchMembership(userId: string): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, is_premium, plan, expires_at')
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data as MembershipRow;
}

export async function fetchMyProfileSummary(): Promise<ProfileSummary> {
  try {
    const userId = await getAuthedUserId();

    if (!userId) {
      return {
        userId: null,
        profile: null,
        postCount: 0,
        friendCount: 0,
        membership: null,
      };
    }

    // 並行查詢（快很多）
    const [profile, postCount, friendCount, membership] = await Promise.all([
      fetchProfileById(userId),
      fetchMyPostCount(userId),
      fetchMyFriendCount(userId),
      fetchMembership(userId),
    ]);

    return { userId, profile, postCount, friendCount, membership };
  } catch (e) {
    console.warn('[profile.repo] fetchMyProfileSummary failed:', e);
    return {
      userId: null,
      profile: null,
      postCount: 0,
      friendCount: 0,
      membership: null,
    };
  }
}
