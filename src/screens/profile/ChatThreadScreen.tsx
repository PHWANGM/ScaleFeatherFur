import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';

import { theme } from '../../styles/tokens';
import { useThemeColors } from '../../styles/themesColors';

import {
  type MessageRow,
  type OtherProfile,
  loadChatThreadInitial,
  subscribeChatThread,
  sendChatMessage,
} from '../../lib/supabase/repos/message.repo';

import MessageInputBar from '../../components/chat/MessageInputBar';
import MessageBubble from '../../components/chat/MessageBubble';

type ChatThreadRoute = RouteProp<{ ChatThread: { conversationId: string } }, 'ChatThread'>;

const formatChatTime = (ts: string) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const Avatar = ({ url, size = 32 }: { url?: string | null; size?: number }) => (
  <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
    {url ? (
      <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <Text style={{ fontSize: size * 0.4, color: '#fff' }}>🐾</Text>
    )}
  </View>
);

export default function ChatThreadScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ChatThreadRoute>();
  const { conversationId } = route.params;

  const textDim = (colors?.subText ?? '#97A3B6') as string;

  const [myId, setMyId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<OtherProfile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');

  const listRef = useRef<FlatList<MessageRow>>(null);

  // ✅ 用來動態調整內容間距的量測值
  const [inputBarHeight, setInputBarHeight] = useState(72);
  const [liftPx, setLiftPx] = useState(0);

  // 1. 載入初始資料與 Header 設定
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadChatThreadInitial({ conversationId, pageLimit: 30 });
      setMyId(res.myId);
      setOtherProfile(res.otherProfile);
      setMessages(res.messages);

      if (res.otherProfile) {
        const info = res.otherProfile;
        navigation.setOptions({
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <Avatar url={info.avatar} size={32} />
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {info.name}
              </Text>
            </View>
          ),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, navigation, colors.text]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // 2. 訂閱即時訊息
  useEffect(() => {
    if (!conversationId || !myId) return;
    return subscribeChatThread({
      conversationId,
      myId,
      onInsert: async (msg) => {
        setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [msg, ...prev]));
      },
      autoMarkRead: true,
    });
  }, [conversationId, myId]);

  // 3. 發送訊息邏輯
  const onSend = useCallback(async () => {
    const body = text.trim();
    if (!body || !myId || sending) return;

    setSending(true);
    setText('');
    const msg = await sendChatMessage({ conversationId, myId, body });
    if (msg) {
      setMessages((prev) => [msg, ...prev]);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
    setSending(false);
  }, [conversationId, myId, sending, text]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // iOS 靠 padding，Android 靠我們在 InputBar 寫的 transform
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.listContent,
              {
                /* ✅ 重要：Inverted 列表的底部其實是 paddingTop。
                  我們加上 liftPx，確保當輸入框抬升時，最後一則訊息也會被推上去，不被遮擋。
                */
                paddingTop: theme.spacing.md + (Platform.OS === 'android' ? liftPx : 0),
                paddingBottom: theme.spacing.lg,
              },
            ]}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                isMine={item.sender_id === myId}
                colors={colors}
                textDim={textDim}
                otherAvatar={otherProfile?.avatar}
                formatTime={formatChatTime}
              />
            )}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          />
        </View>

        {/* ✅ 注入量測與位移回傳函數 
          確保 MessageInputBar 內部有實作 Animated Transform 與鍵盤監聽
        */}
        <MessageInputBar
          value={text}
          onChangeText={setText}
          onSend={onSend}
          sending={sending}
          colors={colors}
          textDim={textDim}
          onHeightChange={setInputBarHeight}
          onLiftPxChange={setLiftPx}
          androidCandidateBar={84}
          extraGap={12}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 },
  headerName: { fontWeight: '700', fontSize: 16 },
  listContent: { paddingHorizontal: theme.spacing.md },
  avatarPlaceholder: { backgroundColor: '#202637', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});