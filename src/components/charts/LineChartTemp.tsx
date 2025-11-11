import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Svg, {
  Line,
  Polyline,
  Text as SvgText,
  Rect,
} from 'react-native-svg';
import type {
  Next24hTempRiskResult,
  TempRiskKind,
} from '../../lib/compliance/envTempForecast.service';

type Props = {
  title: string;
  values: number[];
  unit?: string;
  height?: number;
  maxY?: number;
  minY?: number;
  color?: string;
  tempRisk?: Next24hTempRiskResult | null;
};

export default function LineChartTemp({
  title,
  values,
  unit = '',
  height = 120,
  maxY,
  minY,
  color = '#38e07b',
  tempRisk = null,
}: Props) {
  const width = 340;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  // 🎨 Grid / Axis / Label 顏色設定
  const GRID_COLOR = isDark ? '#374151' : '#f1f3f5'; // 淺灰格線
  const AXIS_COLOR = isDark ? '#4b5563' : '#d1d5db';
  const TICK_TEXT = isDark ? '#9ca3af' : '#6b7280';

  const paddingLeft = 44;
  const paddingRight = 22;
  const paddingTop = 10;
  const paddingBottom = 22;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const { coords, yMin, yMax } = useMemo(() => {
    if (!values || values.length === 0) {
      return { coords: [] as { x: number; y: number }[], yMin: 0, yMax: 1 };
    }

    const _min = minY ?? Math.min(...values);
    const _max = maxY ?? Math.max(...values);
    const range = _max - _min || 1;
    const dx = plotWidth / Math.max(1, values.length - 1);

    const pts: { x: number; y: number }[] = values.map((v, i) => {
      const y = paddingTop + (plotHeight - ((v - _min) / range) * plotHeight);
      const x = paddingLeft + i * dx;
      return { x, y };
    });
    return { coords: pts, yMin: _min, yMax: _max };
  }, [values, plotWidth, plotHeight, paddingLeft, paddingTop, maxY, minY]);

  // Y 軸刻度
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) =>
    yMin + ((yMax - yMin) / (yTicks - 1)) * i
  );

  // X 軸刻度：每 6 小時 + +24h
  const hoursPerTick = 6;
  const tickIdxs = Array.from(
    { length: Math.floor(24 / hoursPerTick) + 1 },
    (_, i) => i * hoursPerTick
  );

  const xAxisY = paddingTop + plotHeight;

  // 🎨 顏色表
  const COLORS: Record<TempRiskKind, string> = {
    too_cold: '#1d4ed8',
    ok: '#16a34a',
    too_hot: '#dc2626',
    unknown: '#6b7280',
  };

  const BG_COLORS: Record<TempRiskKind, string> = {
    too_cold: 'rgba(29,78,216,0.1)', // 淺藍
    ok: 'rgba(22,163,74,0.08)', // 淺綠
    too_hot: 'rgba(220,38,38,0.1)', // 淺紅
    unknown: 'rgba(107,114,128,0.08)', // 灰
  };

  type ColoredSegments = {
    lines: { color: string; path: string }[];
    bgs: { risk: TempRiskKind; fromX: number; toX: number }[];
  };

  const coloredSegments: ColoredSegments = useMemo(() => {
    if (!tempRisk || !tempRisk.hourly?.length || !coords.length) {
      return {
        lines: [
          {
            color,
            path: coords.map(p => `${p.x},${p.y}`).join(' '),
          },
        ],
        bgs: [],
      };
    }

    const lineSegments: { color: string; pts: { x: number; y: number }[] }[] = [];
    const bgSegments: { risk: TempRiskKind; fromX: number; toX: number }[] = [];

    let currentRisk: TempRiskKind = tempRisk.hourly[0].risk;
    let currentPts: { x: number; y: number }[] = [coords[0]];
    let segmentStartX = coords[0].x;

    for (let i = 1; i < coords.length; i++) {
      const risk: TempRiskKind = tempRisk.hourly[i]?.risk ?? 'ok';
      const pt = coords[i];
      if (risk === currentRisk) {
        currentPts.push(pt);
      } else {
        lineSegments.push({ color: COLORS[currentRisk], pts: currentPts });
        bgSegments.push({
          risk: currentRisk,
          fromX: segmentStartX,
          toX: pt.x,
        });
        currentRisk = risk;
        currentPts = [coords[i - 1], pt];
        segmentStartX = coords[i - 1].x;
      }
    }

    if (currentPts.length) {
      lineSegments.push({ color: COLORS[currentRisk], pts: currentPts });
      bgSegments.push({
        risk: currentRisk,
        fromX: segmentStartX,
        toX: coords[coords.length - 1].x,
      });
    }

    return {
      lines: lineSegments.map(seg => ({
        color: seg.color,
        path: seg.pts.map(p => `${p.x},${p.y}`).join(' '),
      })),
      bgs: bgSegments,
    };
  }, [coords, tempRisk, color]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.title}>{title}</Text>

      <Svg width={width} height={height}>
        {/* 🎨 背景區塊 */}
        {coloredSegments.bgs.map((seg, i) => (
          <Rect
            key={`bg-${i}`}
            x={seg.fromX}
            y={paddingTop}
            width={Math.max(1, seg.toX - seg.fromX)}
            height={plotHeight}
            fill={BG_COLORS[seg.risk]}
          />
        ))}

        {/* 🔳 整個灰色 GRID */}
        {/* 垂直線（每 6 小時） */}
        {tickIdxs.map((hour, i) => {
          const x =
            paddingLeft + (Math.min(hour, 24) / 24) * plotWidth;
          return (
            <Line
              key={`grid-x-${i}`}
              x1={x}
              y1={paddingTop}
              x2={x}
              y2={xAxisY}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          );
        })}
        {/* 水平線（每 y tick） */}
        {yLabels.map((_, i) => {
          const ratio = i / (yTicks - 1);
          const yCoord = paddingTop + (plotHeight - ratio * plotHeight);
          return (
            <Line
              key={`grid-y-${i}`}
              x1={paddingLeft}
              y1={yCoord}
              x2={width - paddingRight}
              y2={yCoord}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          );
        })}

        {/* Y 軸標籤 */}
        {yLabels.map((val, i) => {
          const ratio = i / (yTicks - 1);
          const yCoord = paddingTop + (plotHeight - ratio * plotHeight);
          return (
            <SvgText
              key={`ylabel-${i}`}
              x={paddingLeft - 6}
              y={yCoord + 3}
              fontSize="14"
              fill={TICK_TEXT}
              textAnchor="end"
            >
              {Math.round(val * 10) / 10}
            </SvgText>
          );
        })}

        {/* X 軸刻度（Now ~ +24h） */}
        {tickIdxs.map((hour, i) => {
          const x =
            paddingLeft + (Math.min(hour, 24) / 24) * plotWidth;
          const label = i === 0 ? 'Now' : `+${hour}h`;
          return (
            <SvgText
              key={`xlabel-${i}`}
              x={x}
              y={xAxisY + 14}
              fontSize="14"
              fill={TICK_TEXT}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* 座標軸 */}
        <Line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={xAxisY}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />
        <Line
          x1={paddingLeft}
          y1={xAxisY}
          x2={width - paddingRight}
          y2={xAxisY}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />

        {/* 折線：分段上色 */}
        {coloredSegments.lines.map((seg, i) => (
          <Polyline
            key={`seg-${i}`}
            points={seg.path}
            fill="none"
            stroke={seg.color}
            strokeWidth={2.5}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
});
