// src/components/charts/LineChartSimple.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

type Props = {
  title: string;
  values: number[];
  unit?: string;
  height?: number;
  maxY?: number;
  minY?: number;
  color?: string;
};

export default function LineChartSimple({
  title,
  values,
  unit = '',
  height = 100,
  maxY,
  minY,
  color = '#38e07b',
}: Props) {
  const width = 340;

  const GRID_COLOR = '#E5E7EB'; // 淺灰格線
  const TICK_TEXT = '#9CA3AF';  // 灰文字

  const paddingLeft = 44;
  const paddingRight = 22;
  const paddingTop = 10;
  const paddingBottom = 22;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const { points, yMin, yMax } = useMemo(() => {
    if (!values || values.length === 0) {
      return { points: '', yMin: 0, yMax: 1 };
    }
    const _min = minY ?? Math.min(...values);
    const _max = maxY ?? Math.max(...values);
    const range = _max - _min || 1;

    const dx = plotWidth / Math.max(1, values.length - 1);
    const pts = values
      .map((v, i) => {
        const y = paddingTop + (plotHeight - ((v - _min) / range) * plotHeight);
        const x = paddingLeft + i * dx;
        return `${x},${y}`;
      })
      .join(' ');
    return { points: pts, yMin: _min, yMax: _max };
  }, [values, plotWidth, plotHeight, paddingLeft, paddingTop, maxY, minY]);

  // ✅ Y 軸由下到上遞增
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) =>
    yMin + ((yMax - yMin) / (yTicks - 1)) * i
  );

  // ✅ 每 6 小時一格
  const total = Math.max(1, values.length);
  const hoursPerTick = 6;
  const tickIdxs = Array.from(
    { length: Math.floor(total / hoursPerTick) + 1 },
    (_, i) => Math.min(total, i * hoursPerTick)
  );

  const xAxisY = paddingTop + plotHeight;

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.title}>{title}</Text>

      <Svg width={width} height={height}>
        {/* Y 網格 + 標籤 */}
        {yLabels.map((val, i) => {
          const ratio = i / (yTicks - 1);
          const yCoord = paddingTop + (plotHeight - ratio * plotHeight);
          return (
            <React.Fragment key={`y-${i}`}>
              <Line
                x1={paddingLeft}
                y1={yCoord}
                x2={width - paddingRight}
                y2={yCoord}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={yCoord + 3}
                fontSize="14"
                fill={TICK_TEXT}
                textAnchor="end"
              >
                {Math.round(val * 10) / 10}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* ✅ X 軸刻度（每 6 小時；最左邊顯示 Now） */}
        {tickIdxs.map((idx, i) => {
          const x = paddingLeft + (idx / total) * plotWidth;
          const label = i === 0 ? 'Now' : `+${idx}h`;
          return (
            <React.Fragment key={`x-${i}`}>
              <Line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={xAxisY}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
              <SvgText
                x={x}
                y={xAxisY + 14}
                fontSize="16"
                fill={TICK_TEXT}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* 座標軸 */}
        <Line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={xAxisY}
          stroke={GRID_COLOR}
          strokeWidth={1}
        />
        <Line
          x1={paddingLeft}
          y1={xAxisY}
          x2={width - paddingRight}
          y2={xAxisY}
          stroke={GRID_COLOR}
          strokeWidth={1}
        />

        {/* 折線 */}
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  caption: { fontSize: 12, opacity: 0.7, marginTop: 4 },
});
