/**
 * One week in a few numbers: the body, the days kept, the training, and under them the AI's
 * advice. Drawn the same in the pop-up and in the weekly reports on 進度.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { Schema } from '@/api/client';
import { Text } from '@/components/text';
import { WeeklyAdvice } from '@/progress/WeeklyAdvice';

export type Review = Schema<'WeeklyReviewOut'>;

/** "10/5 – 10/11" */
export function weekRange(review: { start: string; end: string }) {
  const short = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8))}`;
  return `${short(review.start)} – ${short(review.end)}`;
}

const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}`;

const thousands = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function WeeklyReport({
  review,
  onLeave,
}: {
  review: Review;
  /** Closes the modal the report is in, before a link opens another screen. */
  onLeave?: () => void;
}) {
  const volumeChange =
    review.previous_volume_kg > 0
      ? Math.round(((review.volume_kg - review.previous_volume_kg) / review.previous_volume_kg) * 100)
      : null;

  return (
    <View className="gap-3">
      <View className="flex-row gap-3">
        <Tile
          label="體重平均"
          value={review.weight_average?.toFixed(1) ?? '—'}
          unit="kg"
          change={review.weight_change}
        />
        <Tile label="腰圍" value={review.waist_latest?.toFixed(1) ?? '—'} unit="cm" change={review.waist_change} />
      </View>
      <View className="flex-row gap-3">
        <Tile label="完成" value={String(review.days_complete)} unit="/ 7 天" />
        <Tile label="訓練" value={String(review.workouts)} unit="次" />
      </View>
      <View className="gap-0.5 rounded-tile border-[1.5px] border-edge bg-surface px-4 py-3">
        <Text className="text-xs text-muted">總訓練量</Text>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[25px] text-ink">
            {thousands(review.volume_kg)}
            <Text className="text-xs text-muted"> kg</Text>
          </Text>
          {volumeChange !== null ? (
            <Text className="text-sm text-muted">
              比上週 {volumeChange > 0 ? '+' : volumeChange < 0 ? '−' : ''}
              {Math.abs(volumeChange)}%
            </Text>
          ) : null}
        </View>
      </View>
      <WeeklyAdvice
        key={review.start}
        start={review.start}
        onPolicy={() => {
          onLeave?.();
          router.push('/privacy');
        }}
      />
    </View>
  );
}

/** A number with its unit, and for the body how far it moved; down is the way it should go. */
function Tile({
  label,
  value,
  unit,
  change,
}: {
  label: string;
  value: string;
  unit: string;
  change?: number | null;
}) {
  return (
    <View className="flex-1 gap-0.5 rounded-tile border-[1.5px] border-edge bg-surface px-4 py-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="text-[25px] text-ink">
        {value}
        {value === '—' ? null : <Text className="text-xs text-muted"> {unit}</Text>}
      </Text>
      {change !== undefined ? (
        <Text className={`text-sm ${change === null ? 'text-muted' : change <= 0 ? 'text-good' : 'text-warm'}`}>
          {change === null ? '比上週 —' : `比上週 ${signed(change)}`}
        </Text>
      ) : null}
    </View>
  );
}
