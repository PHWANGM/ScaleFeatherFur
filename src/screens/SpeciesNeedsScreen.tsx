// src/screens/SpeciesNeedsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigator';
import { getEffectiveTargetForPet, type SpeciesTarget } from '../lib/db/repos/species.targets.repo';
import { getPetWithSpeciesById } from '../lib/db/repos/pets.repo';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeciesNeeds'>;

/** 需求卡片會導向的目標路由（已在 rootNavigator 註冊的那些 Placeholder 名稱） */
type DemandRoute =
  | 'UVBLogScreen'
  | 'HeatControlScreen'
  | 'FeedGreensScreen'
  | 'FeedInsectScreen'
  | 'FeedMeatScreen'
  | 'FeedFruitScreen'
  | 'CalciumPlainScreen'
  | 'CalciumD3Screen'
  | 'VitaminMultiScreen'
  | 'WeighScreen'
  | 'CleanScreen'
  | 'TempMonitorScreen';

type NeedCard = {
  key: string;
  title: string;
  subtitle?: string;
  color: string;
  route: DemandRoute;
};

export default function SpeciesNeedsScreen({ route, navigation }: Props) {
  const { petId } = route.params;
  const [target, setTarget] = useState<SpeciesTarget | null>(null);
  const [petName, setPetName] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pet = await getPetWithSpeciesById(petId);
      const t = await getEffectiveTargetForPet(petId);
      if (!mounted) return;
      setPetName(pet?.name ?? 'My Pet');
      setTarget(t);
    })();
    return () => { mounted = false; };
  }, [petId]);

  const needs: NeedCard[] = useMemo(() => {
    const cards: NeedCard[] = [];

    // UVB（photoperiod）
    if (target?.photoperiod_hours_min != null && target?.photoperiod_hours_max != null) {
      cards.push({
        key: 'uvb',
        title: 'UVB / 日照',
        subtitle:
          `${target.photoperiod_hours_min}-${target.photoperiod_hours_max} 小時/天` +
          (target.uvb_spec ? ` · UVB ${target.uvb_spec}` : ''),
        color: '#FFEFD5',
        route: 'UVBLogScreen',
      });
    }

    // Heat（若物種有 basking/熱區）
    const hasHeat =
      !!target?.temp_ranges?.basking ||
      !!target?.temp_ranges?.hot ||
      !!target?.temp_ranges?.ambient_day;
    if (hasHeat) {
      const b = target?.temp_ranges?.basking
        ? `${target.temp_ranges.basking[0]}-${target.temp_ranges.basking[1]}°C`
        : '';
      cards.push({
        key: 'heat',
        title: '加熱 / 熱點',
        subtitle: b ? `熱點 ${b}` : '管理加熱時數與熱區溫度',
        color: '#E6FCF4',
        route: 'HeatControlScreen',
      });
    }

    // Diet（依 diet_split 產生 feed_*）
    const ds = target?.diet_split ?? undefined;
    if (ds?.greens != null) {
      cards.push({
        key: 'feed_greens',
        title: '餵食：綠餌/牧草',
        subtitle: `${Math.round(ds.greens * 100)}%`,
        color: '#E8F5E9',
        route: 'FeedGreensScreen',
      });
    }
    if (ds?.insect != null) {
      cards.push({
        key: 'feed_insect',
        title: '餵食：昆蟲',
        subtitle: `${Math.round(ds.insect * 100)}%`,
        color: '#FFF8E1',
        route: 'FeedInsectScreen',
      });
    }
    if (ds?.meat != null) {
      cards.push({
        key: 'feed_meat',
        title: '餵食：肉類',
        subtitle: `${Math.round(ds.meat * 100)}%`,
        color: '#FFEFEF',
        route: 'FeedMeatScreen',
      });
    }
    if (ds?.fruit != null) {
      cards.push({
        key: 'feed_fruit',
        title: '餵食：水果',
        subtitle: `${Math.round(ds.fruit * 100)}%`,
        color: '#FFF0F6',
        route: 'FeedFruitScreen',
      });
    }

    // Supplements（D3 / 純鈣 / 維他命）
    const s = target?.supplement_rules ?? null;
    if (s?.calcium_plain) {
      cards.push({
        key: 'calcium_plain',
        title: '補充：純鈣（無 D3）',
        subtitle: s.calcium_plain,
        color: '#F0F9FF',
        route: 'CalciumPlainScreen',
      });
    }
    if (s?.calcium_d3) {
      cards.push({
        key: 'calcium_d3',
        title: '補充：含 D3 鈣粉',
        subtitle: s.calcium_d3,
        color: '#EDE7F6',
        route: 'CalciumD3Screen',
      });
    }
    if (s?.vitamin_multi) {
      cards.push({
        key: 'vitamin',
        title: '補充：綜合維他命',
        subtitle: s.vitamin_multi,
        color: '#FFFDE7',
        route: 'VitaminMultiScreen',
      });
    }

    // Generic：體重 / 清潔 / 溫度監測
    cards.push({ key: 'weigh', title: '量體重', color: '#E3F2FD', route: 'WeighScreen' });
    cards.push({ key: 'clean', title: '清潔/消毒', color: '#F5EEFC', route: 'CleanScreen' });
    cards.push({ key: 'temps', title: '溫度/環境監測', color: '#E6EDFA', route: 'TempMonitorScreen' });

    return cards;
  }, [target]);

  const onPressNeed = (routeName: DemandRoute) => {
    navigation.navigate(routeName, { petId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{petName} 的需求</Text>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        {needs.map((n, idx) => (
          <TouchableOpacity
            key={n.key}
            activeOpacity={0.85}
            onPress={() => onPressNeed(n.route)}
            style={[
              styles.card,
              { backgroundColor: n.color, flexDirection: idx % 2 === 1 ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{n.title}</Text>
              {!!n.subtitle && <Text style={styles.cardSubtitle}>{n.subtitle}</Text>}
            </View>
            <View style={styles.rightSlot} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  headerText: {
    fontSize: 20,
    color: '#7D7D7D',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 16,
  },
  card: {
    marginBottom: 10,
    width: '100%',
    minHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textWrap: { width: '60%', paddingHorizontal: 6 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#2D3748' },
  cardSubtitle: { marginTop: 6, color: '#4A5568' },
  rightSlot: { width: '35%' }, // 未來可放 icon / 圖片
});
