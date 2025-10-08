import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Card from '../components/cards/Card';
import EmptyState from '../components/EmptyState';
import { theme } from '../styles/theme';
import { query } from '../lib/db/db.client';

type Article = { id: string; title: string; body_md: string; tags: string | null };

export default function CommunityScreen() {
  const [items, setItems] = useState<Article[]>([]);
  useEffect(() => { (async () => {
    const rows = await query<Article>(`SELECT id, title, body_md, tags FROM articles ORDER BY updated_at DESC LIMIT 50`);
    setItems(rows);
  })(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>文章</Text>
      <FlatList
        contentContainerStyle={{ gap: theme.spacing.md }}
        data={items}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.tags && <Text style={styles.meta}>tags: {item.tags}</Text>}
            <Text numberOfLines={3} style={styles.body}>{item.body_md}</Text>
          </Card>
        )}
        ListEmptyComponent={<EmptyState title="暫無文章" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.xl },
  h1: { ...theme.typography.h1, color: theme.colors.text, marginBottom: theme.spacing.md },
  title: { ...theme.typography.h3, color: theme.colors.text },
  meta: { ...theme.typography.small },
  body: { ...theme.typography.body, color: theme.colors.textDim, marginTop: theme.spacing.sm },
});
