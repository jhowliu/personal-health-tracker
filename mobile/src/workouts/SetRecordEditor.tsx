/**
 * One exercise's sets, typed in after the fact: a row per set with its reps and weight, or the
 * minutes for timed work. Sets are added and removed freely; nothing is saved from here.
 */
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Chip, Field, Hint, TextAction } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';
import { isTimed, isTreadmill, nextRow, prescribedRows, type Effort, type RecordRow } from '@/workouts/record';

const EFFORTS: readonly (readonly [Effort, 'common.effort.easy' | 'common.effort.appropriate' | 'common.effort.hard', 'good' | 'primary' | 'warm'])[] = [
  ['easy', 'common.effort.easy', 'good'],
  ['appropriate', 'common.effort.appropriate', 'primary'],
  ['hard', 'common.effort.hard', 'warm'],
];

export function SetRecordEditor({
  entry,
  rows,
  onChange,
}: {
  entry: Schema<'WorkoutExecutionItemOut'>;
  rows: RecordRow[];
  onChange: (rows: RecordRow[]) => void;
}) {
  const { t } = useI18n();
  const timed = isTimed(entry);
  const bodyweight = entry.item.equipment === 'bodyweight';
  const update = (index: number, change: Partial<RecordRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const remove = (index: number) => onChange(rows.filter((_, at) => at !== index));
  const last = rows[rows.length - 1];

  if (timed) {
    return rows.length ? (
      <View className="gap-2">
        <View className="flex-row items-end gap-2">
          <Field
            label={t('common.labels.actualTime')}
            suffix={t('common.units.minute')}
            value={rows[0].minutes}
            onChangeText={(minutes) => update(0, { minutes })}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <RemoveButton label={t('workouts.record.clearTime')} onPress={() => remove(0)} />
        </View>
        {isTreadmill(entry) ? (
          <>
            {/* Lines up with the time field, clear of the remove button beside it. */}
            <View className="flex-row gap-2 pr-[52px]">
              <Field
                label={t('workouts.record.speedOptional')}
                suffix="km/h"
                value={rows[0].speed}
                onChangeText={(speed) => update(0, { speed })}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
              <Field
                label={t('workouts.record.inclineOptional')}
                suffix="%"
                placeholder="0"
                value={rows[0].incline}
                onChangeText={(incline) => update(0, { incline })}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>
          </>
        ) : null}
      </View>
    ) : (
      <TextAction
        icon={PlusIcon}
        label={t('workouts.record.timeTarget', { minutes: Math.round((entry.item.duration_sec ?? 60) / 60) })}
        onPress={() => onChange(prescribedRows(entry))}
        className="min-h-[44px] justify-center self-start"
      />
    );
  }

  return (
    <View className="gap-2">
      {rows.length ? (
        <View className="flex-row items-center gap-2">
          <Text className="w-8 text-xs text-muted">{t('common.labels.sets')}</Text>
          <Text className="flex-1 text-xs text-muted">{t('workouts.record.weightHeader')}</Text>
          <Text className="flex-1 text-xs text-muted">{t('common.labels.reps')}</Text>
          <View className="w-11" />
        </View>
      ) : null}
      {rows.map((row, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <Text className="w-8 text-sm text-ink">{index + 1}</Text>
          <Field
            accessibilityLabel={t('workouts.record.setWeight', { number: index + 1 })}
            placeholder={bodyweight ? t('workouts.record.bodyweight') : t('common.states.optional')}
            value={row.weight}
            onChangeText={(weight) => update(index, { weight })}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Field
            accessibilityLabel={t('workouts.record.setReps', { number: index + 1 })}
            value={row.reps}
            onChangeText={(reps) => update(index, { reps })}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <RemoveButton label={t('workouts.record.deleteSet', { number: index + 1 })} onPress={() => remove(index)} />
        </View>
      ))}

      <View className="flex-row flex-wrap items-center gap-x-6">
        <TextAction
          icon={PlusIcon}
          label={t('workouts.record.addSet')}
          onPress={() => onChange([...rows, nextRow(entry, rows)])}
          className="min-h-[44px] justify-center"
        />
        {rows.length === 0 && (entry.item.sets ?? 1) > 1 ? (
          <TextAction
            label={t('workouts.record.fillTargetSets', { count: entry.item.sets ?? 1 })}
            onPress={() => onChange(prescribedRows(entry))}
            className="min-h-[44px] justify-center"
          />
        ) : null}
      </View>

      {last ? (
        <View className="gap-1">
          <Hint>{t('workouts.record.effortQuestion')}</Hint>
          <View className="flex-row gap-2">
            {EFFORTS.map(([effort, labelKey, tone]) => (
              <Chip
                key={effort}
                label={t(labelKey)}
                tone={tone}
                selected={last.effort === effort}
                onPress={() => update(rows.length - 1, { effort: last.effort === effort ? null : effort })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center active:opacity-60"
    >
      <CloseIcon size={18} tint={color.muted} />
    </Pressable>
  );
}
