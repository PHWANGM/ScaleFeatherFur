// src/components/charts/ChartLineWeight.tsx
import { Fragment, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg"
import { theme } from "../../styles/tokens"

type Datum = { x: number; y: number }
type Point = { x: number; y: number }

type Props = {
  data: Datum[] // x: timestamp(ms) or continuous number; y: numeric
  width?: number
  height?: number
  showDots?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  yFormatter?: (v: number) => string
  yTicks?: number // default 4
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const GRID_COLOR = "#E5E7EB"
const AXIS_COLOR = "#D1D5DB"
const LABEL_COLOR = "#9CA3AF"
const LABEL_FONT_SIZE = 12

function clampTicks(n?: number, fallback = 4) {
  if (!n || !Number.isFinite(n)) return fallback
  return Math.max(2, Math.floor(n))
}

function formatDateLabel(ms: number) {
  const d = new Date(ms)
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  return `${mm}/${dd}`
}

function buildSmoothPath(pts: Point[]) {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`

  return pts.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = arr[i - 1]
    const cx = (prev.x + p.x) / 2
    return acc + ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`
  }, "")
}

function buildXTicks(xMin: number, xMax: number) {
  // guard
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return []
  if (xMax <= xMin) return [xMin]

  // short range: show ends
  if (xMax - xMin < 7 * ONE_DAY_MS) return [xMin, xMax]

  const start = new Date(xMin)
  const dayStart = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ).getTime()

  const ticks: number[] = []
  for (let t = dayStart; t <= xMax; t += 7 * ONE_DAY_MS) {
    if (t >= xMin - ONE_DAY_MS) ticks.push(t)
  }

  // ensure end-ish tick exists
  const last = ticks[ticks.length - 1]
  if (!last || last < xMax - 3 * ONE_DAY_MS) ticks.push(xMax)

  // unique + sort
  return Array.from(new Set(ticks)).sort((a, b) => a - b)
}

export default function ChartLineWeight({
  data,
  width = 320,
  height = 140,
  showDots = true,
  showXAxis = false,
  showYAxis = false,
  yFormatter,
  yTicks: yTicksProp = 4,
}: Props) {
  const safeData = Array.isArray(data) ? data : []

  if (safeData.length === 0) {
    return <View style={[styles.box, { width, height }]} />
  }

  const yTicks = clampTicks(yTicksProp, 4)

  const layout = useMemo(() => {
    // padding for labels
    const padLeft = showYAxis ? 50 : 10
    const padRight = 15
    const padTop = 10
    const padBottom = showXAxis ? 30 : 20

    const plotWidth = Math.max(1, width - padLeft - padRight)
    const plotHeight = Math.max(1, height - padTop - padBottom)

    const xs = safeData.map((d) => d.x)
    const ys = safeData.map((d) => d.y)

    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)

    // ✅ Y-axis starts from 0
    const yMin = 0
    const rawYMax = Math.max(...ys)
    const yMax = rawYMax === yMin ? yMin + 1 : rawYMax

    const xDen = xMax - xMin || 1
    const yDen = yMax - yMin || 1

    const scaleX = (x: number) => padLeft + ((x - xMin) / xDen) * plotWidth
    const scaleY = (y: number) => padTop + (1 - (y - yMin) / yDen) * plotHeight

    const pts: Point[] = safeData.map((d) => ({
      x: scaleX(d.x),
      y: scaleY(d.y),
    }))
    const path = buildSmoothPath(pts)

    const xAxisY = padTop + plotHeight
    const xTicks = showXAxis ? buildXTicks(xMin, xMax) : []

    const yRange = yMax - yMin || 1
    const yStep = yRange / (yTicks - 1)
    const yTickValues = Array.from(
      { length: yTicks },
      (_, i) => yMin + i * yStep,
    )

    return {
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      xMin,
      xMax,
      yMin,
      yMax,
      scaleX,
      scaleY,
      pts,
      path,
      xAxisY,
      xTicks,
      yTickValues,
    }
  }, [safeData, width, height, showXAxis, showYAxis, yTicks])

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

        {/* Y axis + grid + labels */}
        {showYAxis && (
          <G>
            {layout.yTickValues.map((val, idx) => {
              const yCoord = layout.scaleY(val)
              return (
                <Fragment key={`y-${idx}`}>
                  <Line
                    x1={layout.padLeft}
                    y1={yCoord}
                    x2={width - layout.padRight}
                    y2={yCoord}
                    stroke={GRID_COLOR}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={layout.padLeft - 6}
                    y={yCoord + 4}
                    fontSize={LABEL_FONT_SIZE}
                    fill={LABEL_COLOR}
                    textAnchor="end"
                  >
                    {formatYLabel(val)}
                  </SvgText>
                </Fragment>
              )
            })}

            <Line
              x1={layout.padLeft}
              y1={layout.padTop}
              x2={layout.padLeft}
              y2={layout.padTop + layout.plotHeight}
              stroke={AXIS_COLOR}
              strokeWidth={1}
            />
          </G>
        )}

        {/* main line */}
        <Path d={layout.path} stroke="url(#grad)" strokeWidth={2} fill="none" />

        {/* dots */}
        {showDots &&
          layout.pts.map((p, i) => (
            <Circle
              key={`pt-${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={theme.colors.primary}
            />
          ))}

        {/* X axis + ticks */}
        {showXAxis && (
          <G>
            <Line
              x1={layout.padLeft}
              y1={layout.xAxisY}
              x2={width - layout.padRight}
              y2={layout.xAxisY}
              stroke={AXIS_COLOR}
              strokeWidth={1}
            />
            {layout.xTicks.map((tx, i) => (
              <SvgText
                key={`x-${i}`}
                x={layout.scaleX(tx)}
                y={layout.xAxisY + 14}
                fontSize={LABEL_FONT_SIZE}
                fill={LABEL_COLOR}
                textAnchor="middle"
              >
                {formatDateLabel(tx)}
              </SvgText>
            ))}
          </G>
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
