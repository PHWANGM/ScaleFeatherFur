// src/screens/PetSelectScreen.tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigator';
import { listPetsWithSpecies, type PetWithSpeciesRow } from '../lib/db/repos/pets.repo';

type Props = NativeStackScreenProps<RootStackParamList, 'PetSelect'>;

export default function PetSelectScreen({ navigation }: Props) {
  const [pets, setPets] = useState<PetWithSpeciesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listPetsWithSpecies({ limit: 200 });
        if (mounted) setPets(rows);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onSelect = (petId: string) => {
    navigation.navigate('SpeciesNeeds', { petId });
  };

  const renderItem = ({ item }: { item: PetWithSpeciesRow }) => {
    const avatarSource = item.avatar_uri
      ? { uri: item.avatar_uri }
      : require('../../assets/adaptive-icon.png'); // 請自行放一張預設圖

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onSelect(item.id)}>
        <View style={styles.avatarWrap}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.petName}>{item.name}</Text>
          <Text style={styles.speciesName}>{item.species_name ?? item.species_key}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>選擇你的寵物</Text>
      {loading ? (
        <Text style={styles.hint}>讀取中…</Text>
      ) : pets.length === 0 ? (
        <Text style={styles.hint}>目前沒有寵物，請先新增。</Text>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  title: { fontSize: 20, color: '#7D7D7D', textAlign: 'center', fontWeight: '600', marginTop: 16 },
  hint: { textAlign: 'center', marginTop: 20, color: '#999' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#F8F9FB',
    borderRadius: 12,
  },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', marginRight: 12, backgroundColor: '#EEE' },
  avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  meta: { flex: 1 },
  petName: { fontSize: 18, fontWeight: '700', color: '#333' },
  speciesName: { marginTop: 2, color: '#6B7280' },
});
