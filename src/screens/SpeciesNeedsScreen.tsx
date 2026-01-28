// src/screens/SpeciesNeedsScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigator';
import { getEffectiveTargetForPet, type SpeciesTarget } from '../lib/db/repos/species.targets.repo';
import { getPetWithSpeciesById } from '../lib/db/repos/pets.repo';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'SpeciesNeeds'>;

type DemandRoute =
  | 'UVBLogScreen'
  | 'HeatControlScreen'
  | 'FeedInputScreen'
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

function fmtHoursRange(
  min?: number | null,
  max?: number | null,
  opts?: {
    hoursLabel?: (h: number) => string; // e.g. "3 hours"
    daysLabel?: (d: number, fixed: string) => string; // e.g. "2 days"
  }
): string | null {
  if (min == null && max == null) return null;
  const a = min ?? max ?? 0;
  const b = max ?? min ?? a;

  const toHuman = (h: number) => {
    if (h >= 48) {
      const d = h / 24;
      const fixed = d.toFixed(h % 24 === 0 ? 0 : 1);
      return opts?.daysLabel ? opts.daysLabel(d, fixed) : `${fixed} days`;
    }
    return opts?.hoursLabel ? opts.hoursLabel(h) : `${h} hours`;
  };

  return `${toHuman(a)}–${toHuman(b)}`;
}

export default function SpeciesNeedsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { petId } = route.params;

  const [target, setTarget] = useState<SpeciesTarget | null>(null);
  const [petName, setPetName] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pet = await getPetWithSpeciesById(petId);
      const tt = await getEffectiveTargetForPet(petId);
      if (!mounted) return;
      setPetName(pet?.name ?? t('speciesNeeds.defaults.petName'));
      setTarget(tt);
    })();
    return () => {
      mounted = false;
    };
  }, [petId, t]);

  const needs: NeedCard[] = useMemo(() => {
    const cards: NeedCard[] = [];
    if (!target) return cards;

    // ==== UVB / Photoperiod ====
    const uvbHours =
      fmtHoursRange(target.uvb_daily_hours_min, target.uvb_daily_hours_max, {
        hoursLabel: (h) => t('speciesNeeds.units.hours', { count: h }),
        daysLabel: (_d, fixed) => t('speciesNeeds.units.daysFloat', { value: fixed }),
      }) ??
      fmtHoursRange(target.photoperiod_hours_min, target.photoperiod_hours_max, {
        hoursLabel: (h) => t('speciesNeeds.units.hours', { count: h }),
        daysLabel: (_d, fixed) => t('speciesNeeds.units.daysFloat', { value: fixed }),
      });

    const uvbUnit = (target.extra && (target.extra as any).uvb_unit) || '%';
    const uvbIntensity =
      target.uvb_intensity_min != null || target.uvb_intensity_max != null
        ? `${target.uvb_intensity_min ?? target.uvb_intensity_max}-${target.uvb_intensity_max ?? target.uvb_intensity_min}${uvbUnit}`
        : null;

    if (uvbHours || uvbIntensity) {
      cards.push({
        key: 'uvb',
        title: t('speciesNeeds.cards.uvb.title'),
        subtitle: [
          uvbHours ? t('speciesNeeds.cards.uvb.perDay', { range: uvbHours }) : null,
          uvbIntensity ? t('speciesNeeds.cards.uvb.intensity', { value: uvbIntensity }) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        color: '#FFEFD5',
        route: 'UVBLogScreen',
      });
    }

    // ==== Diet (feeding interval + note) ====
    if (
      target.feeding_interval_hours_min != null ||
      target.feeding_interval_hours_max != null ||
      target.diet_note
    ) {
      const freq = fmtHoursRange(
        target.feeding_interval_hours_min,
        target.feeding_interval_hours_max,
        {
          hoursLabel: (h) => t('speciesNeeds.units.hours', { count: h }),
          daysLabel: (_d, fixed) => t('speciesNeeds.units.daysFloat', { value: fixed }),
        }
      );
      const subtitle = [
        freq ? t('speciesNeeds.cards.feed.every', { range: freq }) : null,
        target.diet_note || null,
      ]
        .filter(Boolean)
        .join(' · ');

      cards.push({
        key: 'feed_frequency',
        title: t('speciesNeeds.cards.feed.title'),
        subtitle,
        color: '#E8F5E9',
        route: 'FeedInputScreen',
      });
    }

    // ==== Generic ====
    cards.push({
      key: 'weigh',
      title: t('speciesNeeds.cards.weigh.title'),
      color: '#E3F2FD',
      route: 'WeighScreen',
    });

    cards.push({
      key: 'clean',
      title: t('speciesNeeds.cards.clean.title'),
      color: '#F5EEFC',
      route: 'CleanScreen',
    });

    return cards;
  }, [target, t]);

  const onPressNeed = (routeName: DemandRoute) => {
    navigation.navigate(routeName as any, { petId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        {t('speciesNeeds.header', { petName })}
      </Text>

      <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
        {needs.length === 0 ? (
          <View style={[styles.card, { backgroundColor: '#FFF6E5' }]}>
            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{t('speciesNeeds.empty.title')}</Text>
              <Text style={styles.cardSubtitle}>{t('speciesNeeds.empty.subtitle')}</Text>
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
