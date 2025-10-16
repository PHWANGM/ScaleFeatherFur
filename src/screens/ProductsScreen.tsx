import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Card from '../components/cards/Card';
import EmptyState from '../components/EmptyState';
import { theme } from '../styles/tokens';
import { AppDispatch, RootState } from '../state/store';
import { searchProductsByTags } from '../state/slices/productsSlice';

export default function ProductsScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((s: RootState) => s.products);

  useEffect(() => { dispatch(searchProductsByTags(['UVB','sulcata'])); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>產品推薦</Text>
      <FlatList
        contentContainerStyle={{ gap: theme.spacing.md }}
        data={items}
        keyExtractor={p => p.id}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.title}>{item.name}</Text>
            {!!item.brand && <Text style={styles.meta}>品牌：{item.brand}</Text>}
            {!!item.region && <Text style={styles.meta}>地區：{item.region}</Text>}
            {!!item.tags && <Text style={styles.meta}>tags: {item.tags}</Text>}
          </Card>
        )}
        ListEmptyComponent={<EmptyState title={loading ? '載入中…' : '暫無產品'} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.xl },
  h1: { ...theme.typography.h1, color: theme.colors.text, marginBottom: theme.spacing.md },
  title: { ...theme.typography.h3, color: theme.colors.text },
  meta: { ...theme.typography.small },
});
