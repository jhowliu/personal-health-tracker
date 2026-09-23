/**
 * 身形趨勢圖:灰點是每次紀錄,粗線是 7 天平均。
 *
 * 只吃後端 /body-logs/summary 回傳的點,不在這裡算平均。
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { color } from '@/theme/tokens';

export type TrendPoint = { date: string; value: number; average_7d: number | null };

const HEIGHT = 140;
const PADDING = 8;

export function TrendChart({
  title,
  unit,
  points,
  stroke = color.primary,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  stroke?: string;
}) {
  const [width, setWidth] = useState(0);

  const values = points.flatMap((p) => [p.value, p.average_7d ?? p.value]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (index: number) =>
    PADDING + (index / Math.max(points.length - 1, 1)) * (width - PADDING * 2);
  const y = (value: number) =>
    HEIGHT - PADDING - ((value - min) / span) * (HEIGHT - PADDING * 2);

  // x 用原本的索引,不能用過濾後的,否則缺平均值的點會讓整條線錯位。
  const average = points
    .map((p, index) => (p.average_7d === null ? null : `${x(index)},${y(p.average_7d)}`))
    .filter((point): point is string => point !== null)
    .join(' ');

  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-semibold text-ink">{title}</Text>
        <Text className="text-sm text-muted">{unit}</Text>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 && points.length > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={PADDING}
              y1={HEIGHT - PADDING}
              x2={width - PADDING}
              y2={HEIGHT - PADDING}
              stroke={color.line}
              strokeWidth={1}
            />
            {average ? (
              <Polyline
                points={average}
                fill="none"
                stroke={stroke}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {points.map((point, index) => (
              <Circle
                key={point.date}
                cx={x(index)}
                cy={y(point.value)}
                r={2.5}
                fill={color.muted}
              />
            ))}
          </Svg>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-muted">還沒有紀錄</Text>
          </View>
        )}
      </View>

      <Text className="text-xs text-muted">灰點:每次紀錄　粗線:7 天平均</Text>
    </View>
  );
}
