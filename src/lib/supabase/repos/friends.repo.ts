// src/lib/supabase/repos/friends.repo.ts
import { supabase } from '../../supabase'; // 依你專案：若你的 supabase export 在 src/lib/supabase/index.ts，改成 '../../supabase'
import type { ProfileRow } from './profile.repo';

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | string;

export type FriendRequestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
  updated_at: string;
};

export type FriendItem = {
  userId: string;
  profile: ProfileRow | null;
};

export type RelationSets = {
  friends: Set<string>;
  pending: Set<string>;
  blockedEitherWay: Set<string>;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizePair(a: string, b: string): { user_a: string; user_b: string } {
  // friendships 的 PK 是 (user_a, user_b)，用字典序固定順序可避免重複
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function fetchProfilesByIds(ids: string[]): Promise<Record<string, ProfileRow>> {
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, location_city')
    .in('id', ids);

  if (error || !data) return {};

  const map: Record<string, ProfileRow> = {};
  for (const row of data as ProfileRow[]) map[row.id] = row;
  return map;
}

export async function fetchFriendIds(myId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);

  if (error || !data) return [];
  const ids = new Set<string>();

  for (const r of data as Array<{ user_a: string; user_b: string }>) {
    const other = r.user_a === myId ? r.user_b : r.user_a;
    if (other && other !== myId) ids.add(other);
  }

  return Array.from(ids);
}

export async function fetchIncomingRequests(myId: string): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, from_user_id, to_user_id, status, created_at, updated_at')
    .eq('to_user_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as FriendRequestRow[];
}

export async function fetchOutgoingRequests(myId: string): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, from_user_id, to_user_id, status, created_at, updated_at')
    .eq('from_user_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as FriendRequestRow[];
}

export async function fetchRelationSets(myId: string): Promise<RelationSets> {
  // friends
  const { data: fData } = await supabase
    .from('friendships')
    .select('user_a, user_b')
    .or(`user_a.eq.${myId},user_b.eq.${myId}`);

  const friends = new Set<string>();
  for (const r of (fData ?? []) as Array<{ user_a: string; user_b: string }>) {
    const other = r.user_a === myId ? r.user_b : r.user_a;
    if (other && other !== myId) friends.add(other);
  }

  // pending (both directions)
  const { data: rData } = await supabase
    .from('friend_requests')
    .select('from_user_id, to_user_id, status')
    .or(`from_user_id.eq.${myId},to_user_id.eq.${myId}`)
    .eq('status', 'pending');

  const pending = new Set<string>();
  for (const r of (rData ?? []) as Array<{ from_user_id: string; to_user_id: string; status: string }>) {
    const other = r.from_user_id === myId ? r.to_user_id : r.from_user_id;
    if (other && other !== myId) pending.add(other);
  }

  // blocks (either direction)
  const { data: bData } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);

  const blockedEitherWay = new Set<string>();
  for (const r of (bData ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    const other = r.blocker_id === myId ? r.blocked_id : r.blocker_id;
    if (other && other !== myId) blockedEitherWay.add(other);
  }

  return { friends, pending, blockedEitherWay };
}

export async function fetchCandidateProfiles(limit = 60): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, location_city')
    .limit(limit);

  if (error || !data) return [];
  return data as ProfileRow[];
}

export async function sendFriendRequest(fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;

  // ✅ 建議：避免對方先送你，你又送回去 -> 形成雙 pending
  // 若你想更嚴謹，可以查一下反向是否已存在 pending，存在就直接 accept（看你產品規則）
  await supabase.from('friend_requests').upsert(
    {
      from_user_id: fromId,
      to_user_id: toId,
      status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    { onConflict: 'from_user_id,to_user_id' }
  );
}

export async function acceptFriendRequest(req: FriendRequestRow): Promise<void> {
  // 1) request -> accepted
  await supabase.from('friend_requests').update({ status: 'accepted', updated_at: nowIso() }).eq('id', req.id);

  // 2) insert friendship
  const { user_a, user_b } = normalizePair(req.from_user_id, req.to_user_id);
  await supabase.from('friendships').upsert(
    { user_a, user_b, created_at: nowIso() },
    { onConflict: 'user_a,user_b' }
  );
}

export async function rejectFriendRequest(reqId: string): Promise<void> {
  await supabase.from('friend_requests').update({ status: 'rejected', updated_at: nowIso() }).eq('id', reqId);
}

export async function cancelFriendRequest(reqId: string): Promise<void> {
  await supabase.from('friend_requests').update({ status: 'canceled', updated_at: nowIso() }).eq('id', reqId);
}

export async function removeFriend(myId: string, otherId: string): Promise<void> {
  const { user_a, user_b } = normalizePair(myId, otherId);
  await supabase.from('friendships').delete().eq('user_a', user_a).eq('user_b', user_b);
}
