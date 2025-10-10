// src/components/buttons/PrimaryButton.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '../../styles/themesColors';

type Props = {
  title: string;                 // 按鈕上顯示的文字
  onPress?: () => void;          // 按下時的動作
  disabled?: boolean;            // 是否禁用
  loading?: boolean;             // 是否顯示 loading
  style?: ViewStyle;             // 可選：額外樣式
};

/**
 * PrimaryButton - 主要動作按鈕（自動跟隨亮/暗主題）
 */
const PrimaryButton: React.FC<Props> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const { colors, isDark } = useThemeColors();

  const palette = {
    background: colors.primary ?? '#38e07b',
    text: isDark ? '#122017' : '#ffffff', // 亮暗主題下的反差文字色
  };

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: palette.background, opacity: disabled || loading ? 0.6 : 1 },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.text, { color: palette.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export default PrimaryButton;

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
});
