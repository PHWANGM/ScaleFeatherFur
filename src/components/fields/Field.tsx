// src/components/fields/Field.tsx
import React, { PropsWithChildren, useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useThemeColors } from '../../styles/Themes';

type FieldProps = PropsWithChildren<{
  label?: string;
  containerStyle?: ViewStyle;
  // 可選：允許外部覆蓋 label 顏色（不傳就用主題）
  labelColor?: string;
  // 可選：label 與內容間距
  gap?: number;
}>;

export default function Field({
  label,
  children,
  containerStyle,
  labelColor,
  gap = 6,
}: FieldProps) {
  const { colors, isDark } = useThemeColors();

  const styles = useMemo(() => {
    const labelStyle: TextStyle = {
      color: labelColor ?? colors.text,     // ← 預設跟隨 theme colors.text
      fontSize: 13,
      fontWeight: '600',
      opacity: isDark ? 0.95 : 0.9,         // ← 依 isDark 微調
      marginBottom: gap,
    };
    return StyleSheet.create({
      container: { marginBottom: 12 },
      label: labelStyle,
      body: {},
    });
  }, [colors.text, isDark, labelColor, gap]);

  return (
    <View style={[styles.container, containerStyle]}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.body}>{children}</View>
    </View>
  );
}
