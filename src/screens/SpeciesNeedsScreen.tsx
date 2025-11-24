// src/screens/SpeciesNeedsScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigator';
import { getEffectiveTargetForPet, type SpeciesTarget } from '../lib/db/repos/species.targets.repo';
import { getPetWithSpeciesById } from '../lib/db/repos/pets.repo';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeciesNeeds'>;

type DemandRoute =
  | 'UVBLogScreen'
  | 'HeatControlScreen'
  | 'FeedInputScreen'   // 餵食設定頁（之後在這頁合併 D3 / 鈣粉週期）
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

function fmtHoursRange(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null;
  const a = min ?? max ?? 0;
  const b = max ?? min ?? a;
  const toHuman = (h: number) => (h >= 48 ? `${(h / 24).toFixed(h % 24 === 0 ? 0 : 1)} 天` : `${h} 小時`);
  return `${toHuman(a)}–${toHuman(b)}`;
}

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
    if (!target) return cards;

    // ==== UVB / 日照 ====
    const uvbHours =
      fmtHoursRange(target.uvb_daily_hours_min, target.uvb_daily_hours_max) ??
      fmtHoursRange(target.photoperiod_hours_min, target.photoperiod_hours_max);
    const uvbUnit = (target.extra && (target.extra as any).uvb_unit) || '%';
    const uvbIntensity =
      target.uvb_intensity_min != null || target.uvb_intensity_max != null
        ? `${target.uvb_intensity_min ?? target.uvb_intensity_max}-${target.uvb_intensity_max ?? target.uvb_intensity_min}${uvbUnit}`
        : null;

    if (uvbHours || uvbIntensity) {
      cards.push({
        key: 'uvb',
        title: 'UVB / 日照',
        subtitle: [uvbHours ? `${uvbHours}/天` : null, uvbIntensity ? `強度 ${uvbIntensity}` : null]
          .filter(Boolean)
          .join(' · '),
        color: '#FFEFD5',
        route: 'UVBLogScreen',
      });
    }

    // ==== Heat（優先 temp_ranges；否則 ambient 範圍） ====
    const hasTempRanges =
      !!(target as any)?.temp_ranges?.basking ||
      !!(target as any)?.temp_ranges?.hot ||
      !!(target as any)?.temp_ranges?.ambient_day;

    if (hasTempRanges) {
      const tr = (target as any).temp_ranges as
        | { basking?: [number, number]; hot?: [number, number]; ambient_day?: [number, number] }
        | undefined;
      const basking = tr?.basking ? `${tr.basking[0]}–${tr.basking[1]}°C` : null;
      const hot = tr?.hot ? `${tr.hot[0]}–${tr.hot[1]}°C` : null;

      const subtitle = basking
        ? `熱點 ${basking}`
        : hot
          ? `熱區 ${hot}`
          : '管理加熱時數與熱區溫度';

      cards.push({
        key: 'heat',
        title: '加熱 / 熱點',
        subtitle,
        color: '#E6FCF4',
        route: 'HeatControlScreen',
      });
    } else if (target.ambient_temp_c_min != null || target.ambient_temp_c_max != null) {
      const ambMin = target.ambient_temp_c_min ?? target.ambient_temp_c_max;
      const ambMax = target.ambient_temp_c_max ?? target.ambient_temp_c_min ?? ambMin;
      cards.push({
        key: 'heat_ambient',
        title: '環境溫度',
        subtitle: `${ambMin}–${ambMax}°C`,
        color: '#E6FCF4',
        route: 'HeatControlScreen',
      });
    }

    // ==== Diet（只顯示餵食頻率 + 備註；鈣粉週期與 D3 週期改到餵食設定頁處理） ====
    if (target.feeding_interval_hours_min != null || target.feeding_interval_hours_max != null || target.diet_note) {
      const freq = fmtHoursRange(target.feeding_interval_hours_min, target.feeding_interval_hours_max);
      const subtitle = [freq ? `每 ${freq} / 次` : null, target.diet_note || null]
        .filter(Boolean)
        .join(' · ');
      cards.push({
        key: 'feed_frequency',
        title: '餵食頻率 / 飲食',
        subtitle,
        color: '#E8F5E9',
        route: 'FeedInputScreen', // 若你有專屬餵食設定頁，改這個 route
      });
    }

    // ==== Generic：體重 / 清潔 / 溫度監測 ====
    cards.push({ key: 'weigh', title: '量體重', color: '#E3F2FD', route: 'WeighScreen' });
    cards.push({ key: 'clean', title: '清潔/消毒', color: '#F5EEFC', route: 'CleanScreen' });
    return cards;
  }, [target]);

  const onPressNeed = (routeName: DemandRoute) => {
    navigation.navigate(routeName as any, { petId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>{petName} 的需求</Text>
      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        {needs.length === 0 ? (
          <View style={[styles.card, { backgroundColor: '#FFF6E5' }]}>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>尚未有可顯示的需求</Text>
              <Text style={styles.cardSubtitle}>
                請在 species_targets 中填入 UVB、溫度或餵食頻率等欄位。
              </Text>
            </View>
            <View style={styles.rightSlot} />
          </View>
        ) : (
          needs.map((n, idx) => (
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
          ))
        )}
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
  rightSlot: { width: '35%' },
});
