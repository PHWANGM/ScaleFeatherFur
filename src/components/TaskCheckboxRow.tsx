import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { theme } from '../styles/theme';

type Props = {
  title: string;
  description?: string;
  checked: boolean;
  points?: number;
  onToggle: () => void;
};

export default function TaskCheckboxRow({ title, description, checked, points = 5, onToggle }: Props) {
  return (
    <Pressable onPress={onToggle} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {!!description && <Text style={styles.desc}>{description}</Text>}
      </View>
      <View style={styles.points}>
        <Text style={styles.pointText}>{checked ? `+${points}` : `${points}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: theme.colors.primary,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
  },
  texts: { flex: 1 },
  title: { ...theme.typography.h3, color: theme.colors.text },
  desc: { ...theme.typography.small },
  points: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pointText: { color: theme.colors.accent, fontWeight: '600' },
});
