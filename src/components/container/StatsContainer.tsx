// src/components/StatsContainer/StatsContainer.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';

import StatsBox from './StatsBox';
import { selectCurrentPetId, selectSelectedDate } from '../../state/slices/petsSlice';
import {
  getComplianceReportForWeek,
  type ComplianceReport,
} from '../../lib/db/services/compliance.service';

/** 將 0~1 的比例轉成百分比字串（四捨五入） */
function toPctStr(ratio?: number | null): string {
  if (ratio == null || !isFinite(ratio)) return '0';
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return String(Math.round(pct));
}

/** 溫度平均達標率（只平均有樣本的 zones；若都沒樣本 -> 0） */
function avgTempInRange(report: ComplianceReport): number {
  const arr = report.temps?.perZone ?? [];
  const withSamples = arr.filter((z) => (z.samples ?? 0) > 0);
  if (withSamples.length === 0) return 0;
  const sum = withSamples.reduce((s, z) => s + (z.inRangeRatio ?? 0), 0);
  return sum / withSamples.length;
}

/** UVB 目標區間（小時） -> "min–max" 字串；若無 -> "—" */
function uvbTargetHoursRangeText(report: ComplianceReport): string {
  const r = report.uvb?.targetHoursRange;
  if (!r || r[0] == null || r[1] == null) return '—';
  const [minH, maxH] = r;
  const f = (n: number) => (isFinite(n) ? n.toFixed(1) : '0.0');
  return `${f(minH)}–${f(maxH)}`;
}

/** 解析補充品規則字串成「本週目標次數區間」；unknown -> "?" */
function parseWeeklyTargetCount(rule?: string | null): string {
  if (!rule) return '?';
  const m1 = rule.match(/^per_week:(\d+)(?:-(\d+))?$/);
  if (m1) {
    const min = parseInt(m1[1], 10);
    const max = m1[2] ? parseInt(m1[2], 10) : min;
    return `${min}-${max}`;
  }
  const m2 = rule.match(/^per_2_weeks:(\d+)$/);
  if (m2) {
    // 顯示「以週」視角，粗略對半
    const val = Math.round(parseInt(m2[1], 10) / 2);
    return `${val}-${val}`;
  }
  if (rule === 'every_meal') return '?'; // 以次數難以驗證
  return '?';
}

const StatsContainer: React.FC = () => {
  const selectedDate = useSelector(selectSelectedDate);
  const currentPetId = useSelector(selectCurrentPetId);
  const isFocused = useIsFocused();

  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const dateISO = useMemo(() => selectedDate ?? new Date().toISOString(), [selectedDate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!currentPetId) {
        setReport(null);
        return;
      }
      setLoading(true);
      try {
        const r = await getComplianceReportForWeek(currentPetId, dateISO);
        if (!cancelled) setReport(r);
      } catch (err) {
        console.warn('[StatsContainer] getComplianceReportForWeek error:', err);
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (isFocused) load();
    else setReport(null);

    return () => {
      cancelled = true;
    };
  }, [isFocused, currentPetId, dateISO]);

  // === 轉成卡片顯示字串 ===

  // UVB
  const uvbDataStr = useMemo(() => {
    if (!report) return '0/—';
    const actual = isFinite(report.uvb?.actualHours ?? 0) ? (report.uvb?.actualHours ?? 0) : 0;
    const targetStr = uvbTargetHoursRangeText(report);
    return `${actual.toFixed(1)}/${targetStr}`;
  }, [report]);

  // Diet (g)：顯示本週總克數 / 目標克數（目前無目標 -> "—"）
  const dietDataStr = useMemo(() => {
    if (!report) return '0/—';
    const total = report.diet?.totalGrams ?? 0;
    const targetG = '—'; // 若之後在 SpeciesTarget 補上 grams 目標，可替換為實值
    return `${Math.round(total)}/${targetG}`;
  }, [report]);

  // Supplement - D3
  const d3DataStr = useMemo(() => {
    if (!report) return '0/?';
    const actual = report.supplements?.d3ActualCount ?? 0;
    const targetStr = parseWeeklyTargetCount(report.supplements?.d3PerWeekRule ?? null);
    return `${actual}/${targetStr}`;
  }, [report]);

  // Supplement - Vitamin（新增）
  const vitaminDataStr = useMemo(() => {
    if (!report) return '0/?';
    const actual = report.supplements?.vitaminCount ?? 0;
    const rule = report.target?.supplement_rules?.vitamin_multi ?? null;
    const targetStr = parseWeeklyTargetCount(rule);
    return `${actual}/${targetStr}`;
  }, [report]);

  // Temp
  const tempDataStr = useMemo(() => {
    if (!report) return '0/100';
    const avg = avgTempInRange(report);
    return `${toPctStr(avg)}/100`;
  }, [report]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.grid}>
          {/* UVB */}
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#E6EDFA"
              textC="#2871C8"
              activity="UVB"
              data={uvbDataStr}
              small="h"
            />
          </View>

          {/* Diet 改為克數 */}
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#FEE8DC"
              textC="#EE7942"
              activity="Diet"
              data={dietDataStr}
              small="g"
            />
          </View>

          {/* D3 */}
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#FFEFF1"
              textC="#FD5B71"
              activity="D3"
              data={d3DataStr}
              small="x"
            />
          </View>

          {/* Vitamin（新增） */}
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#FFF8E1"
              textC="#C27D00"
              activity="Vitamin"
              data={vitaminDataStr}
              small="x"
            />
          </View>

          {/* Temp */}
          <View style={styles.gridItem}>
            <StatsBox
              backgroundC="#F5EEFC"
              textC="#9B51E0"
              activity="Temp"
              data={tempDataStr}
              small="%"
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default StatsContainer;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    width: '100%',
  },
  gridItem: {
    width: '45%',
    marginBottom: 0,
  },
});
