import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Card from '../components/cards/Card';
import EmptyState from '../components/EmptyState';
import { theme } from '../styles/tokens';
import { AppDispatch, RootState } from '../state/store';
import { searchProductsByTags } from '../state/slices/productsSlice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((s: RootState) => s.products);

  useEffect(() => { dispatch(searchProductsByTags(['UVB','sulcata'])); }, []);

  return (
    <View style={styles.container}>
      {/* Header with Settings */}
      <View style={styles.header}>
        <Text style={styles.h1}>產品推薦</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Feather name="settings" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  h1: { ...theme.typography.h1, color: theme.colors.text },
  settingsButton: {
    padding: theme.spacing.sm,
  },
  title: { ...theme.typography.h3, color: theme.colors.text },
  meta: { ...theme.typography.small },
});
