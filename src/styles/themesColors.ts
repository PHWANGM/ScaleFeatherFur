// src/styles/themesColors.ts
import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { colors as baseColors } from './tokens';

export function useThemeColors() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = useMemo(
    () => ({
      ...baseColors,
      bg: isDark ? '#122017' : '#f6f8f7',
      card: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
      text: isDark ? '#ffffff' : '#1f2937',
      subText: isDark ? '#d1d5db' : '#4b5563',
      border: 'rgba(56,224,123,0.3)',
      primary: '#38e07b', 
    }),
    [isDark]
  );

  return { colors, isDark };
}
