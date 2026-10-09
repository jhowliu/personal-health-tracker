/**
 * Body trend chart over the last 30 days: the solid line joins each entry, placed by its date so
 * a gap of days shows as a gap; the faint dashed line is the 7-day average. The axis starts at
 * the first entry rather than 30 days back, so a new user's week fills the card.
 *
 * Consumes the points returned by /body-logs/summary; no averaging happens here.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { FONT_FAMILY, Text } from '@/components/text';
import { daysBetween, valueAxis } from '@/components/trend-axis';
import { dayWord, shiftDay, todayISO } from '@/dates';
import { color } from '@/theme/tokens';

export type TrendPoint = { date: string; value: number; average_7d: number | null };

const WINDOW_DAYS = 30;
const MIN_DAYS_SHOWN = 7;
const HEIGHT = 160;
// Room for the value labels on the left and the dates below.
const PAD = { left: 34, right: 12, top: 10, bottom: 22 };

const oneDecimal = (value: number) => value.toFixed(1);
const tickLabel = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function TrendChart({
  title,
  unit,
  points,
  stroke = color.primary,
  minSpan = 2,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  stroke?: string;
  /** The narrowest value range drawn, in the chart's unit. */
  minSpan?: number;
}) {
  const [width, setWidth] = useState(0);

  // The server's window ends on its today; trust the later of the two clocks.
  const first = points[0];
  const last = points[points.length - 1];
  const end = last && last.date > todayISO() ? last.date : todayISO();
  const windowStart = shiftDay(end, -(WINDOW_DAYS - 1));
  const shortest = shiftDay(end, -(MIN_DAYS_SHOWN - 1));
  const fromFirst = first && first.date < shortest ? first.date : shortest;
  const start = fromFirst < windowStart ? windowStart : fromFirst;
  const daysShown = daysBetween(start, end);

  const values = points.map((p) => p.value);
  const axis = valueAxis(
    points.flatMap((p) => (p.average_7d === null ? [p.value] : [p.value, p.average_7d])),
    minSpan,
  );

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (iso: string) =>
    PAD.left + (Math.min(Math.max(daysBetween(start, iso), 0), daysShown) / daysShown) * plotWidth;
  const y = (value: number) =>
    PAD.top + (1 - (value - axis.min) / (axis.max - axis.min)) * plotHeight;

  const entries = points.map((p) => `${x(p.date)},${y(p.value)}`).join(' ');
  const average = points
    .filter((p) => p.average_7d !== null)
    .map((p) => `${x(p.date)},${y(p.average_7d as number)}`)
    .join(' ');

  const summary =
    last &&
    `${title}，最新 ${oneDecimal(last.value)}，近 30 天最低 ${oneDecimal(Math.min(...values))}、最高 ${oneDecimal(Math.max(...values))}`;

  return (
    <View className="gap-2 rounded-card border-2 border-edge bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base text-ink">{title}</Text>
        <Text className="text-sm text-muted">
          {last && points.length >= 2 ? (
            <Text className="text-base text-ink">{oneDecimal(last.value)} </Text>
          ) : null}
          {unit}
        </Text>
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        accessible={points.length >= 2}
        accessibilityLabel={points.length >= 2 ? summary : undefined}
      >
        {width > 0 && points.length >= 2 ? (
          <Svg width={width} height={HEIGHT}>
            {axis.ticks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={PAD.left}
                y1={y(tick)}
                x2={width - PAD.right}
                y2={y(tick)}
                stroke={color.line}
                strokeWidth={1}
              />
            ))}
            {axis.ticks.map((tick) => (
              <SvgText
                fontFamily={FONT_FAMILY}
                key={`tick-${tick}`}
                x={PAD.left - 6}
                y={y(tick) + 3.5}
                fontSize={10}
                fill={color.muted}
                textAnchor="end"
              >
                {tickLabel(tick)}
              </SvgText>
            ))}
            <SvgText
              fontFamily={FONT_FAMILY}
              x={PAD.left}
              y={HEIGHT - 4}
              fontSize={10}
              fill={color.muted}
              textAnchor="start"
            >
              {dayWord(start)}
            </SvgText>
            <SvgText
              fontFamily={FONT_FAMILY}
              x={width - PAD.right}
              y={HEIGHT - 4}
              fontSize={10}
              fill={color.muted}
              textAnchor="end"
            >
              {dayWord(end)}
            </SvgText>

            {average ? (
              <Polyline
                points={average}
                fill="none"
                stroke={stroke}
                strokeOpacity={0.45}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            <Polyline
              points={entries}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point) => (
              <Circle key={point.date} cx={x(point.date)} cy={y(point.value)} r={3} fill={stroke} />
            ))}
            {/* The latest entry, whose value the header shows. */}
            <Circle cx={x(last.date)} cy={y(last.value)} r={4.5} fill={stroke} stroke={color.surface} strokeWidth={2} />
          </Svg>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-center text-sm text-muted">
              {points.length === 0 ? '還沒有紀錄' : '再多記幾天，就會看到趨勢'}
            </Text>
          </View>
        )}
      </View>

      {points.length >= 2 ? (
        <Text className="text-xs text-muted">實線：每次紀錄　虛線：7 天平均</Text>
      ) : null}
    </View>
  );
}
