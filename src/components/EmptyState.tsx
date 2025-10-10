import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/tokens';

export default function EmptyState({ title = '沒有資料', hint }: { title?: string; hint?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.card,
  },
  title: { ...theme.typography.h3, color: theme.colors.text },
  hint: { ...theme.typography.small },
});
