// src/components/chat/MessageInputBar.tsx
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import type { KeyboardEvent } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { theme } from "../../styles/tokens"

type MessageInputBarColors = {
  bg: string
  border: string
  card: string
  text: string
  primary: string
}

export type MessageInputBarProps = {
  value: string
  onChangeText: (t: string) => void
  onSend: () => void | Promise<void>
  sending?: boolean
  colors: MessageInputBarColors
  textDim: string
  placeholder?: string
  onHeightChange?: (h: number) => void
  onLiftPxChange?: (px: number) => void
  androidCandidateBar?: number
  extraGap?: number
}

const MessageInputBar = (props: MessageInputBarProps) => {
  const {
    value,
    onChangeText,
    onSend,
    sending = false,
    colors,
    textDim,
    placeholder = "聊聊寵物吧...",
    onHeightChange,
    onLiftPxChange,
    androidCandidateBar = 84, // 預估候選字列高度
    extraGap = 12,
  } = props

  const insets = useSafeAreaInsets()
  const canSend = useMemo(() => !!value.trim() && !sending, [sending, value])

  // ---- 位移動畫邏輯 ----
  const liftAnim = useRef(new Animated.Value(0)).current
  const containerRef = useRef<View>(null)
  const windowHeight = Dimensions.get("window").height

  // 輔助通知外部位移量
  const emitLift = useCallback((px: number) => {
    onLiftPxChange?.(px)
  }, [onLiftPxChange])

  const runAnimation = useCallback((toValue: number) => {
    emitLift(toValue)
    Animated.timing(liftAnim, {
      toValue,
      duration: Platform.OS === "android" ? 150 : 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [liftAnim, emitLift])

  useEffect(() => {
    if (Platform.OS !== "android") return

    const onShow = (e: KeyboardEvent) => {
      const keyboardHeight = e.endCoordinates.height
      // 測量輸入框目前在螢幕上的位置
      containerRef.current?.measureInWindow((_x, y, _width, height) => {
        const inputBottomY = y + height
        const keyboardTopY = windowHeight - keyboardHeight

        // 需要抬升的距離 = (輸入框底部 - 鍵盤頂部) + 候選列空間 + 額外留白
        const overlap = inputBottomY -
          (keyboardTopY - androidCandidateBar - extraGap)
        if (overlap > 0) {
          runAnimation(overlap)
        }
      })
    }

    const onHide = () => {
      runAnimation(0)
    }

    const showSub = Keyboard.addListener("keyboardDidShow", onShow)
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide)

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [windowHeight, androidCandidateBar, extraGap, runAnimation])

  return (
    <Animated.View
      ref={containerRef}
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.inputContainer,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          paddingBottom: Platform.OS === "ios"
            ? Math.max(insets.bottom, 12)
            : 12,
          // ✅ 這裡才是真正產生移動的地方
          transform: [{ translateY: Animated.multiply(liftAnim, -1) }],
        },
      ]}
    >
      <View
        style={[styles.inputWrapper, {
          backgroundColor: colors.card,
          borderColor: colors.border,
        }]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={textDim}
          multiline
          style={[styles.textInput, { color: colors.text }]}
          textAlignVertical="center"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? colors.primary : colors.border,
              opacity: sending ? 0.8 : 1,
            },
          ]}
        >
          {sending
            ? <ActivityIndicator size="small" color="#122017" />
            : <Text style={styles.sendButtonText}>發送</Text>}
        </Pressable>
      </View>
    </Animated.View>
  )
}

export default MessageInputBar

const styles = StyleSheet.create({
  inputContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  textInput: { flex: 1, paddingVertical: 8, maxHeight: 110, fontSize: 16 },
  sendButton: {
    width: 56,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonText: { color: "#122017", fontWeight: "700", fontSize: 14 },
})
