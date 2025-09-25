import React, { PropsWithChildren } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';

type Props = PropsWithChildren<{ style?: ViewStyle }>;

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
});
