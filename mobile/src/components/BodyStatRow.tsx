import { View } from 'react-native';

import type { Schema } from '@/api/client';
import { Text } from '@/components/text';
import { useI18n } from '@/i18n/runtime';

type Stats = Pick<Schema<'BodySummaryOut'>, 'week_avg_weight' | 'week_avg_delta' | 'latest_waist'>;

/** 本週平均, 比上週 and 最近腰圍 side by side, on 今天's body step and on 進度. */
export function BodyStatRow({ stats }: { stats: Stats }) {
  const { t } = useI18n();
  const delta = stats.week_avg_delta;
  return (
    <View className="flex-row gap-3">
      <BodyStat label={t('common.labels.weeklyAverage')} value={stats.week_avg_weight?.toFixed(1)} unit="kg" />
      <BodyStat
        label={t('common.labels.comparedWithLastWeek')}
        value={delta === null ? undefined : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(1)}`}
        unit="kg"
        // Losing weight is the goal, so a drop reads as good.
        tone={delta === null ? undefined : delta <= 0 ? 'text-good' : 'text-warm'}
      />
      <BodyStat label={t('common.labels.latestWaist')} value={stats.latest_waist?.toFixed(1)} unit="cm" />
    </View>
  );
}

function BodyStat({ label, value, unit, tone }: { label: string; value?: string; unit: string; tone?: string }) {
  return (
    // justify-between keeps the numbers on one line when a label wraps (Weekly / average).
    <View className="flex-1 justify-between gap-0.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={`text-[25px] ${tone ?? 'text-ink'}`}>
        {value ?? '—'}
        {value ? <Text className="text-xs text-muted"> {unit}</Text> : null}
      </Text>
    </View>
  );
}
