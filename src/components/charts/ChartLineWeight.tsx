// src/components/charts/ChartLineWeight.tsx
import React from "react"
import { StyleSheet, View } from "react-native"
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg"
import { theme } from "../../styles/tokens"

type Point = { x: number; y: number }

type Props = {
  data: { x: number; y: number }[] // y 為數值，x 為 timestamp (ms) 或其他連續數值
  width?: number
  height?: number
  showDots?: boolean
  showXAxis?: boolean // 是否顯示 X 軸（時間刻度）
  showYAxis?: boolean // 是否顯示 Y 軸與刻度
  yFormatter?: (v: number) => string // 自訂 Y 軸文字格式（例如加上 kg / g）
  yTicks?: number // Y 軸刻度數量（預設 4）
}

export default function ChartLineWeight({
  data,
  width = 320,
  height = 140,
  showDots = true,
  showXAxis = false,
  showYAxis = false,
  yFormatter,
  yTicks = 4,
}: Props) {
  if (!data || data.length === 0) {
    return <View style={[styles.box, { width, height }]} />
  }

  const xs = data.map((d) => d.x)
  const ys = data.map((d) => d.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)

  // ✅ Y 軸從 0 開始
  const rawYMax = Math.max(...ys)
  let yMin = 0
  let yMax = rawYMax

  // 避免全部數值都一樣（或都是 0）時 range = 0 導致除以 0
  if (yMax === yMin) {
    yMax = yMin + 1
  }

  // padding 要留空間給 Y 軸文字 / X 軸文字
  const padLeft = showYAxis ? 50 : 10
  const padRight = 15
  const padTop = 10
  const padBottom = showXAxis ? 30 : 20

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const scaleX = (x: number) =>
    padLeft + ((x - xMin) / (xMax - xMin || 1)) * plotWidth

  const scaleY = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin || 1)) * plotHeight

  const pts: Point[] = data.map((d) => ({ x: scaleX(d.x), y: scaleY(d.y) }))

  // 🌈 平滑曲線 path
  const path = pts.length === 1
    ? `M ${pts[0].x} ${pts[0].y}`
    : pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const p0 = arr[i - 1]
      const cx = (p0.x + p.x) / 2
      return acc + ` C ${cx} ${p0.y}, ${cx} ${p.y}, ${p.x} ${p.y}`
    }, "")

  // 🧭 X 軸：每 7 天一個刻度
  const xAxisY = padTop + plotHeight
  const oneDayMs = 24 * 60 * 60 * 1000

  let xTicks: number[] = []
  if (showXAxis) {
    const startDate = new Date(xMin)
    // 從第一個點的「當天 00:00」開始
    const firstDayStart = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    )
    let t = firstDayStart.getTime()

    // 如果區間不到 7 天，也至少顯示頭尾
    if (xMax - xMin < 7 * oneDayMs) {
      xTicks = [xMin, xMax]
    } else {
      while (t <= xMax + 1) {
        if (t >= xMin - oneDayMs) {
          xTicks.push(t)
        }
        t += 7 * oneDayMs
      }
      // 保證最後一個 tick 接近 xMax
      if (
        xTicks.length === 0 || xTicks[xTicks.length - 1] < xMax - 3 * oneDayMs
      ) {
        xTicks.push(xMax)
      }
    }

    // 去重 + 排序
    xTicks = Array.from(new Set(xTicks)).sort((a, b) => a - b)
  }

  const formatDateLabel = (ms: number) => {
    const d = new Date(ms)
    const mm = d.getMonth() + 1
    const dd = d.getDate()
    return `${mm}/${dd}`
  }

  // 🧮 Y 軸刻度（0 → yMax）
  const yRange = yMax - yMin || 1
  const yStep = yRange / (yTicks - 1)
  const yTickValues = Array.from({ length: yTicks }, (_, i) => yMin + i * yStep)

  const formatYLabel = (v: number) =>
    yFormatter ? yFormatter(v) : `${Math.round(v * 10) / 10}`

  return (
    <View style={[styles.box, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.colors.accent} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* 🧱 Y 軸 + grid + Y 標籤 */}
        {showYAxis &&
          yTickValues.map((val, idx) => {
            const yCoord = scaleY(val)
            return (
              <React.Fragment key={`y-${idx}`}>
                {/* grid 線 */}
                <Line
                  x1={padLeft}
                  y1={yCoord}
                  x2={width - padRight}
                  y2={yCoord}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
                {/* Y 軸文字 */}
                <SvgText
                  x={padLeft - 6}
                  y={yCoord + 4}
                  fontSize={15}
                  fill="#9CA3AF"
                  textAnchor="end"
                >
                  {formatYLabel(val)}
                </SvgText>
              </React.Fragment>
            )
          })}

        {/* Y 軸本身 */}
        {showYAxis && (
          <Line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + plotHeight}
            stroke="#D1D5DB"
            strokeWidth={1}
          />
        )}

        {/* 折線 */}
        <Path d={path} stroke="url(#grad)" strokeWidth={2} fill="none" />

        {/* 資料點 */}
        {showDots &&
          pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={theme.colors.primary}
            />
          ))}

        {/* 🧭 X 軸 + 日期標籤 */}
        {showXAxis && (
          <>
            {/* x 軸線 */}
            <Line
              x1={padLeft}
              y1={xAxisY}
              x2={width - padRight}
              y2={xAxisY}
              stroke="#D1D5DB"
              strokeWidth={1}
            />
            {/* 每個 tick 的標籤 */}
            {xTicks.map((tx, i) => (
              <SvgText
                key={`x-${i}`}
                x={scaleX(tx)}
                y={xAxisY + 12}
                fontSize={15}
                fill="#9CA3AF"
                textAnchor="middle"
              >
                {formatDateLabel(tx)}
              </SvgText>
            ))}
          </>
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "transparent",
  },
})
