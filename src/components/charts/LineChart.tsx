// src/components/charts/LineChart.tsx
import React, { useMemo } from "react"
import { StyleSheet, Text, useColorScheme, View } from "react-native"
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg"
import type {
  Next24hTempRiskResult,
  TempRiskKind,
} from "../../lib/compliance/envTempForecast.service"
import type {
  Next24hUvbRiskResult,
  UvbRiskKind,
} from "../../lib/compliance/uvbForecast.service"
import { theme } from "../../styles/tokens"

type Props = {
  title: string
  values: number[]
  unit?: string
  height?: number
  maxY?: number
  minY?: number
  color?: string

  /** 溫度風險（ambient_temp_c_min/max） */
  tempRisk?: Next24hTempRiskResult | null
  /** UVB 風險（uvb_intensity_min/max，以 UVI 序列為輸入） */
  uvbRisk?: Next24hUvbRiskResult | null
}

type AnyRiskKind = TempRiskKind | UvbRiskKind

export default function LineChart({
  title,
  values,
  unit = "",
  height = 120,
  maxY,
  minY,
  color = "#38e07b",
  tempRisk = null,
  uvbRisk = null,
}: Props) {
  const width = 340
  const scheme = useColorScheme()
  const isDark = scheme === "dark"

  // 🎨 Grid / Axis / Label 顏色設定
  const GRID_COLOR = isDark ? "#374151" : "#f1f3f5"
  const AXIS_COLOR = isDark ? "#4b5563" : "#d1d5db"
  const TICK_TEXT = isDark ? "#9ca3af" : "#6b7280"

  const paddingLeft = 44
  const paddingRight = 22
  const paddingTop = 10
  const paddingBottom = 22

  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom

  const { coords, yMin, yMax } = useMemo(() => {
    if (!values || values.length === 0) {
      return { coords: [] as { x: number; y: number }[], yMin: 0, yMax: 1 }
    }

    const _min = minY ?? Math.min(...values)
    const _max = maxY ?? Math.max(...values)
    const range = _max - _min || 1
    const dx = plotWidth / Math.max(1, values.length - 1)

    const pts: { x: number; y: number }[] = values.map((v, i) => {
      const y = paddingTop + (plotHeight - ((v - _min) / range) * plotHeight)
      const x = paddingLeft + i * dx
      return { x, y }
    })
    return { coords: pts, yMin: _min, yMax: _max }
  }, [values, plotWidth, plotHeight, paddingLeft, paddingTop, maxY, minY])

  // Y 軸刻度
  const yTicks = 5
  const yLabels = Array.from(
    { length: yTicks },
    (_, i) => yMin + ((yMax - yMin) / (yTicks - 1)) * i,
  )

  // X 軸刻度（每 6 小時）
  const hoursPerTick = 6
  const tickIdxs = Array.from(
    { length: Math.floor(24 / hoursPerTick) + 1 },
    (_, i) => i * hoursPerTick,
  )

  const xAxisY = paddingTop + plotHeight

  // 背景顏色：同時支援 temp & uvb 的 risk kind
  const BG_COLORS: Record<AnyRiskKind, string> = {
    too_cold: "rgba(29, 79, 216, 0.30)", // 溫度過冷／UVB 太低 → 淺藍
    too_low: "rgba(29, 79, 216, 0.30)", // UVB too_low
    ok: "rgba(22, 163, 74, 0.30)", // 安全範圍 → 淺綠
    too_hot: "rgba(220,38,38,0.30)", // 溫度過熱／UVB 太高 → 淺紅
    too_high: "rgba(220,38,38,0.30)", // UVB too_high
    unknown: "rgba(107,114,128,0.08)", // 無資料 → 淺灰
  }

  type BgSegment = { risk: AnyRiskKind; fromX: number; toX: number }

  const bgSegments: BgSegment[] = useMemo(() => {
    const source = uvbRisk ?? tempRisk
    if (!source || !source.hourly?.length || !coords.length) return []

    const segments: BgSegment[] = []
    let currentRisk: AnyRiskKind = (source.hourly[0].risk ??
      "ok") as AnyRiskKind
    let segmentStartX = coords[0].x

    for (let i = 1; i < coords.length; i++) {
      const risk = (source.hourly[i]?.risk ?? "ok") as AnyRiskKind
      const pt = coords[i]
      if (risk !== currentRisk) {
        segments.push({
          risk: currentRisk,
          fromX: segmentStartX,
          toX: pt.x,
        })
        currentRisk = risk
        segmentStartX = pt.x
      }
    }
    // 最後一段
    segments.push({
      risk: currentRisk,
      fromX: segmentStartX,
      toX: coords[coords.length - 1].x,
    })
    return segments
  }, [coords, tempRisk, uvbRisk])

  // 單一漸層折線
  const linePoints = useMemo(
    () => coords.map((p) => `${p.x},${p.y}`).join(" "),
    [coords],
  )

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.title}>
        {title}
        {unit ? ` (${unit})` : ""}
      </Text>

      <Svg width={width} height={height}>
        {/* 🌈 漸層定義（與 ChartLineWeight 相同） */}
        <Defs>
          <LinearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ef4444" stopOpacity="1" />
            <Stop offset="1" stopColor="#3b82f6" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* 🎨 背景區塊（依 risk 區間著色） */}
        {bgSegments.map((seg, i) => (
          <Rect
            key={`bg-${i}`}
            x={seg.fromX}
            y={paddingTop}
            width={Math.max(1, seg.toX - seg.fromX)}
            height={plotHeight}
            fill={BG_COLORS[seg.risk]}
          />
        ))}

        {/* 🔳 GRID：垂直線 */}
        {tickIdxs.map((hour, i) => {
          const x = paddingLeft + (Math.min(hour, 24) / 24) * plotWidth
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
          )
        })}

        {/* 🔳 GRID：水平線 */}
        {yLabels.map((_, i) => {
          const ratio = i / (yTicks - 1)
          const yCoord = paddingTop + (plotHeight - ratio * plotHeight)
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
          )
        })}

        {/* Y 軸標籤 */}
        {yLabels.map((val, i) => {
          const ratio = i / (yTicks - 1)
          const yCoord = paddingTop + (plotHeight - ratio * plotHeight)
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
          )
        })}

        {/* X 軸刻度（Now ~ +24h） */}
        {tickIdxs.map((hour, i) => {
          const x = paddingLeft + (Math.min(hour, 24) / 24) * plotWidth
          const label = i === 0 ? "Now" : `+${hour}h`
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
          )
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

        {/* 🌈 單一漸層折線 */}
        {coords.length > 0 && (
          <Polyline
            points={linePoints}
            fill="none"
            stroke="url(#tempGrad)"
            strokeWidth={2.5}
          />
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
})
