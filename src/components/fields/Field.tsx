// src/components/fields/Field.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  children: React.ReactNode;
};

export default function Field({ label, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
});
