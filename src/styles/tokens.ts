// Design Tokens: spacing / typo / colors / radii / shadows
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32,
};

export const radii = {
  sm: 8, md: 12, lg: 16, xl: 24,
};

export const colors = {
  bg: '#0D0F14',
  card: '#141823',
  primary: '#7AA8FF',
  primaryAlt: '#5C8DFF',
  accent: '#6BF0C7',
  text: '#E6ECF2',
  textDim: '#97A3B6',
  border: '#202637',
  warn: '#FFB020',
  critical: '#FF5A5F',
  success: '#32D583',
  info: '#60A5FA',
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: 0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0.2 },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  small: { fontSize: 12, color: colors.textDim },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

export const theme = { spacing, radii, colors, typography, shadows };
export type Theme = typeof theme;
