// src/screens/ProductsScreen.tsx
import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import Card from '../components/cards/Card';
import EmptyState from '../components/EmptyState';
import { theme } from '../styles/tokens';
import { AppDispatch, RootState } from '../state/store';
import { searchProductsByTags } from '../state/slices/productsSlice';

export default function ProductsScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    dispatch(searchProductsByTags(['UVB', 'sulcata']));
  }, [dispatch]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>{t('products.title')}</Text>

      <FlatList
        contentContainerStyle={{ gap: theme.spacing.md }}
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.title}>{item.name}</Text>

            {!!item.brand && (
              <Text style={styles.meta}>
                {t('products.fields.brand')}: {item.brand}
              </Text>
            )}

            {!!item.region && (
              <Text style={styles.meta}>
                {t('products.fields.region')}: {item.region}
              </Text>
            )}

            {!!item.tags && (
              <Text style={styles.meta}>
                {t('products.fields.tags')}: {item.tags}
              </Text>
            )}
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title={loading ? t('products.loading') : t('products.empty')}
          />
        }
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
