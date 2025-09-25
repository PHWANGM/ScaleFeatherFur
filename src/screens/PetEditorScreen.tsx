import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import Card from '../components/cards/Card';
import { theme } from '../styles/theme';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../state/store';
import { upsertPet } from '../state/slices/petsSlice';

export default function PetEditorScreen({ route, navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const editing = route?.params?.pet ?? null;

  const [name, setName] = useState(editing?.name ?? '');
  const [species, setSpecies] = useState(editing?.species_key ?? 'sulcata');
  const [habitat, setHabitat] = useState(editing?.habitat ?? 'indoor_uvb');

  const save = async () => {
    const res = await dispatch(upsertPet({ id: editing?.id, name, species_key: species, habitat }));
    if (res.meta.requestStatus === 'fulfilled') navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.h2}>{editing ? '編輯寵物' : '新增寵物'}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>名稱</Text>
          <TextInput style={styles.input} placeholder="小烏龜" placeholderTextColor={theme.colors.textDim} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>物種 key</Text>
          <TextInput style={styles.input} value={species} onChangeText={setSpecies} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>棲地</Text>
          <TextInput style={styles.input} value={habitat} onChangeText={setHabitat} />
        </View>

        <Pressable onPress={save} style={styles.btn}>
          <Text style={styles.btnText}>儲存</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.xl },
  h2: { ...theme.typography.h2, color: theme.colors.text, marginBottom: theme.spacing.lg },
  field: { marginBottom: theme.spacing.md },
  label: { ...theme.typography.small },
  input: {
    marginTop: 6, padding: theme.spacing.md, borderRadius: theme.radii.md,
    borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text,
  },
  btn: {
    marginTop: theme.spacing.lg, backgroundColor: theme.colors.primary,
    padding: theme.spacing.md, borderRadius: theme.radii.lg, alignItems: 'center',
  },
  btnText: { color: '#0B1220', fontWeight: '700' },
});
