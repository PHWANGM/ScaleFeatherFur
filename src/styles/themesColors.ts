// src/styles/themesColors.ts
import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

// 你也可以在這裡 import 原有的 theme.colors 作為基底
import { colors as baseColors } from './tokens';

/**
 * 提供動態亮/暗主題顏色（可在任意元件使用）
 */
export function useThemeColors() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = useMemo(
    () => ({
      ...baseColors,
      // 動態覆蓋
      bg: isDark ? '#122017' : '#f6f8f7',
      card: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
      text: isDark ? '#ffffff' : '#1f2937',
      subText: isDark ? '#d1d5db' : '#4b5563',
      border: 'rgba(56,224,123,0.3)',
      primary: '#38e07b', // ← 可以用你 HomeScreen 原本的主色
    }),
    [isDark]
  );

  return { colors, isDark };
}
