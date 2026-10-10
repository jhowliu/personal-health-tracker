/**
 * Training volume, weight × reps, as a bar per week; this week's bar is pale while it fills.
 * Summed by week because single days swing between leg day and a rest day.
 *
 * Consumes /progress/volume; the sums are the server's.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import type { Schema } from '@/api/client';
import { FONT_FAMILY, Text } from '@/components/text';
import { zeroAxis } from '@/components/trend-axis';
import { color } from '@/theme/tokens';

type Trend = Schema<'VolumeTrendOut'>;

const HEIGHT = 140;
// Room for the kilograms on the left and the dates below.
const PAD = { left: 44, right: 8, top: 10, bottom: 22 };

const thousands = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const shortDate = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;

export function VolumeChart({ trend }: { trend: Trend }) {
  const [width, setWidth] = useState(0);
  const weeks = trend.weeks;
  const lastWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  const thisWeek = weeks[weeks.length - 1];
  const trained = weeks.some((week) => week.volume_kg > 0);

  const axis = zeroAxis(Math.max(...weeks.map((week) => week.volume_kg)));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / weeks.length;
  const bar = Math.min(slot * 0.6, 18);
  const y = (value: number) => PAD.top + (1 - value / axis.max) * plotHeight;

  const summary =
    lastWeek && thisWeek
      ? `訓練量，近 ${weeks.length} 週，上週 ${thousands(lastWeek.volume_kg)} 公斤，本週目前 ${thousands(thisWeek.volume_kg)} 公斤`
      : undefined;

  return (
    <View className="gap-2 rounded-card border-2 border-edge bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base text-ink">訓練量</Text>
        <Text className="text-sm text-muted">
          {trained && lastWeek ? (
            <Text className="text-base text-ink">上週 {thousands(lastWeek.volume_kg)} </Text>
          ) : null}
          kg，近 {weeks.length} 週
        </Text>
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        accessible={trained}
        accessibilityLabel={trained ? summary : undefined}
      >
        {width > 0 && trained ? (
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
                {thousands(tick)}
              </SvgText>
            ))}
            {weeks.map((week, index) =>
              week.volume_kg > 0 ? (
                <Rect
                  key={week.start}
                  x={PAD.left + index * slot + (slot - bar) / 2}
                  y={y(week.volume_kg)}
                  width={bar}
                  height={PAD.top + plotHeight - y(week.volume_kg)}
                  rx={3}
                  fill={color.good}
                  // This week is still being trained.
                  fillOpacity={week.start === trend.this_week ? 0.4 : 1}
                />
              ) : null,
            )}
            <SvgText
              fontFamily={FONT_FAMILY}
              x={PAD.left + slot / 2}
              y={HEIGHT - 4}
              fontSize={10}
              fill={color.muted}
              textAnchor="middle"
            >
              {shortDate(weeks[0].start)}
            </SvgText>
            <SvgText
              fontFamily={FONT_FAMILY}
              x={PAD.left + (weeks.length - 0.5) * slot}
              y={HEIGHT - 4}
              fontSize={10}
              fill={color.muted}
              textAnchor="middle"
            >
              本週
            </SvgText>
          </Svg>
        ) : !trained ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-center text-sm text-muted">還沒有訓練紀錄</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
