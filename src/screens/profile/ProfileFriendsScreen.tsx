// src/screens/profile/ProfileFriendsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/rootNavigator';

import { getAuthedUserId, type ProfileRow } from '../../lib/supabase/repos/profile.repo';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriendIds,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  fetchProfilesByIds,
  removeFriend as removeFriendRepo,
  rejectFriendRequest,
  type FriendItem,
  type FriendRequestRow,
} from '../../lib/supabase/repos/friends.repo';
import { createOrGetDm } from '../../lib/supabase/repos/message.repo';

export default function ProfileFriendsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [myId, setMyId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [friendItems, setFriendItems] = useState<FriendItem[]>([]);
  const [incoming, setIncoming] = useState<Array<FriendRequestRow & { fromProfile?: ProfileRow | null }>>([]);
  const [outgoing, setOutgoing] = useState<Array<FriendRequestRow & { toProfile?: ProfileRow | null }>>([]);

  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = await getAuthedUserId();
      setMyId(uid);

      if (!uid) {
        setFriendItems([]);
        setIncoming([]);
        setOutgoing([]);
        return;
      }

      const [friendIds, inReqs, outReqs] = await Promise.all([
        fetchFriendIds(uid),
        fetchIncomingRequests(uid),
        fetchOutgoingRequests(uid),
      ]);

      const profileIds = Array.from(
        new Set<string>([
          ...friendIds,
          ...inReqs.map((r) => r.from_user_id),
          ...outReqs.map((r) => r.to_user_id),
        ])
      );

      const map = await fetchProfilesByIds(profileIds);

      setFriendItems(
        friendIds.map((id) => ({
          userId: id,
          profile: map[id] ?? null,
        }))
      );

      setIncoming(inReqs.map((r) => ({ ...r, fromProfile: map[r.from_user_id] ?? null })));
      setOutgoing(outReqs.map((r) => ({ ...r, toProfile: map[r.to_user_id] ?? null })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friendItems;
    return friendItems.filter((f) => (f.profile?.display_name ?? '').toLowerCase().includes(q));
  }, [friendItems, query]);

  const renderSectionHeader = (title: string, subtitle?: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading friends…</Text>
      </View>
    );
  }

  if (!myId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.muted}>Please sign in to use Friends.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search friends…"
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Incoming Requests */}
      {renderSectionHeader('Friend Requests', incoming.length ? `${incoming.length} incoming` : 'No incoming requests')}
      {incoming.length > 0 && (
        <View style={styles.card}>
          {incoming.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.fromProfile?.display_name ?? r.from_user_id}</Text>
                <Text style={styles.muted}>wants to add you</Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={async () => {
                  try {
                    await acceptFriendRequest(r);
                    await load();
                  } catch {
                    Alert.alert('Error', 'Failed to accept request.');
                  }
                }}
              >
                <Text style={styles.btnTextPrimary}>Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={async () => {
                  try {
                    await rejectFriendRequest(r.id);
                    await load();
                  } catch {
                    Alert.alert('Error', 'Failed to reject request.');
                  }
                }}
              >
                <Text style={styles.btnTextGhost}>Reject</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Outgoing Requests */}
      {renderSectionHeader('Pending Sent', outgoing.length ? `${outgoing.length} sent` : 'No pending sent requests')}
      {outgoing.length > 0 && (
        <View style={styles.card}>
          {outgoing.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{r.toProfile?.display_name ?? r.to_user_id}</Text>
                <Text style={styles.muted}>pending…</Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={async () => {
                  try {
                    await cancelFriendRequest(r.id);
                    await load();
                  } catch {
                    Alert.alert('Error', 'Failed to cancel request.');
                  }
                }}
              >
                <Text style={styles.btnTextGhost}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Friends List */}
      {renderSectionHeader('Your Friends', `${filteredFriends.length} friends`)}

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.userId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.friendRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.profile?.display_name ?? item.userId}</Text>
              {!!item.profile?.location_city && <Text style={styles.muted}>{item.profile.location_city}</Text>}
            </View>

            {/* ✅ NEW: Message button */}
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={async () => {
                try {
                  const res = await createOrGetDm(item.userId);
                  if (!res) {
                    Alert.alert('Error', 'Failed to create conversation.');
                    return;
                  }
                  navigation.navigate('ChatThread', {
                    conversationId: res.conversationId,
                    title: res.title,
                  } as never);
                } catch {
                  Alert.alert('Error', 'Failed to open chat.');
                }
              }}
            >
              <Text style={styles.btnTextGhost}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={() => {
                Alert.alert('Remove friend?', `Remove ${item.profile?.display_name ?? 'this user'} from friends?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await removeFriendRepo(myId, item.userId);
                        await load();
                      } catch {
                        Alert.alert('Error', 'Failed to remove friend.');
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.btnTextPrimary}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No friends yet. Go to “Match” to add some!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  muted: { color: '#777', marginTop: 4 },

  search: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  sectionHeader: { marginTop: 10, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSubtitle: { color: '#777', marginTop: 2 },

  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },

  rowTitle: { fontSize: 15, fontWeight: '600' },

  btn: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  btnPrimary: { backgroundColor: '#111', borderColor: '#111' },
  btnDanger: { backgroundColor: '#c62828', borderColor: '#c62828' },
  btnGhost: { backgroundColor: 'transparent', borderColor: '#ddd' },

  btnTextPrimary: { color: '#fff', fontWeight: '700' },
  btnTextGhost: { color: '#333', fontWeight: '600' },
});
