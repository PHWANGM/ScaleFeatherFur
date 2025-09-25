import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import Card from './cards/Card';
import { theme } from '../styles/theme';

type Props = {
  severity: 'info' | 'warn' | 'critical';
  title: string;
  body: string;
  products?: { id: string; name: string; affiliate_url?: string | null }[];
  onOpenArticle?: () => void;
};

const pillColor: Record<Props['severity'], string> = {
  info: theme.colors.info, warn: theme.colors.warn, critical: theme.colors.critical,
};

export default function AlertSolutionCard({ severity, title, body, products, onOpenArticle }: Props) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: pillColor[severity] }]} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>

      {!!products?.length && (
        <View style={styles.actions}>
          {products.slice(0, 2).map(p => (
            <Pressable
              key={p.id}
              onPress={() => p.affiliate_url && Linking.openURL(p.affiliate_url)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionText}>產品：{p.name}</Text>
            </Pressable>
          ))}
          {!!onOpenArticle && (
            <Pressable onPress={onOpenArticle} style={[styles.actionBtn, styles.outline]}>
              <Text style={styles.actionText}>延伸文章</Text>
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  pill: { width: 10, height: 10, borderRadius: 20 },
  title: { ...theme.typography.h2, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.textDim },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md, flexWrap: 'wrap' },
  actionBtn: {
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primaryAlt + '22',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
  },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  actionText: { color: theme.colors.text },
});
