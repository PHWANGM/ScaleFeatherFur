import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { theme } from '../../styles/tokens';

type Point = { x: number; y: number };
type Props = {
  data: { x: number; y: number }[];    // y 為數值，x 為時間/索引
  width?: number;
  height?: number;
  showDots?: boolean;
};

export default function ChartLine({ data, width = 320, height = 120, showDots = true }: Props) {
  if (!data || data.length < 2) return <View style={[styles.box, { width, height }]} />;

  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = 8;

  const scaleX = (x: number) => pad + ((x - xMin) / (xMax - xMin || 1)) * (width - pad * 2);
  const scaleY = (y: number) => pad + (1 - (y - yMin) / (yMax - yMin || 1)) * (height - pad * 2);

  const pts: Point[] = data.map(d => ({ x: scaleX(d.x), y: scaleY(d.y) }));

  const path = pts.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const p0 = arr[i - 1];
    const cx = (p0.x + p.x) / 2;
    return acc + ` C ${cx} ${p0.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  return (
    <View style={[styles.box, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="1" />
            <Stop offset="1" stopColor={theme.colors.accent} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d={path} stroke="url(#grad)" strokeWidth={2} fill="none" />
        {showDots && pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={theme.colors.primary} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: 'transparent',
  },
});
