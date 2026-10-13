/**
 * One exercise in the day's workout, a row in the day's list. Closed, it reads as a summary line;
 * opened, it holds the exercise's sets and target for editing in place, and the buttons to swap
 * it or take it off the day. Nothing is saved from here: the day's workout saves every open
 * change at once.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Field, Hint, PrimaryButton } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { color } from '@/theme/tokens';
import { type RecordRow } from '@/workouts/record';
import { SetRecordEditor } from '@/workouts/SetRecordEditor';
import { type TargetEdit } from '@/workouts/target';

type Entry = Schema<'WorkoutExecutionItemOut'>;

/** Done: a timed exercise has its minutes, a set-based one every planned set. */
export function isItemDone(entry: Entry): boolean {
  return entry.item.duration_sec
    ? entry.logs.length > 0
    : (entry.logs.length || entry.completed_set_count) >= (entry.item.sets ?? 1);
}

function status(entry: Entry): string {
  const prescribed = entry.item;
  if (isItemDone(entry)) return translate('workouts.item.completed');
  if (prescribed.duration_sec) {
    return `${Math.round(prescribed.duration_sec / 60)} ${translate('common.units.minute')}`;
  }
  if (entry.logs.length) return translate('workouts.item.setProgress', { done: entry.logs.length, total: prescribed.sets ?? 1 });
  return `${translate('common.counts.sets.other', { count: prescribed.sets ?? 1 })}${prescribed.reps ? ` × ${prescribed.reps}` : ''}${
    prescribed.weight_kg !== null ? ` · ${prescribed.weight_kg} kg` : ''
  }`;
}

export function WorkoutItemRow({
  entry,
  index,
  open,
  onToggle,
  target,
  onTargetChange,
  rows,
  onRowsChange,
  edited,
  suggestion,
  busy,
  word,
  onReplace,
  onRemove,
  handle,
}: {
  entry: Entry;
  index: number;
  open: boolean;
  onToggle: () => void;
  /** The target fields: what was typed, or the prescription as it stands. */
  target: TargetEdit;
  onTargetChange: (target: TargetEdit) => void;
  /** The sets: what was typed, or what is logged. */
  rows: RecordRow[];
  onRowsChange: (rows: RecordRow[]) => void;
  /** Something here is typed in and not saved yet. */
  edited: boolean;
  /** The weight the last save suggests for next time. */
  suggestion: number | undefined;
  busy: boolean;
  word: string;
  onReplace: () => void;
  onRemove: () => void;
  /** The drag handle from the list, before the row's own button. */
  handle?: ReactNode;
}) {
  const { t } = useI18n();
  const prescribed = entry.item;
  const done = isItemDone(entry);
  const set = (change: Partial<TargetEdit>) => onTargetChange({ ...target, ...change });

  return (
    <View className={open ? 'bg-warm-soft' : ''}>
      <View className="flex-row items-center pl-1">
        {handle}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(open ? 'common.accessibility.collapseNamed' : 'common.accessibility.editNamed', {
            name: prescribed.exercise_name,
          })}
          accessibilityState={{ expanded: open, disabled: busy }}
          disabled={busy}
          onPress={onToggle}
          className={`min-h-[66px] flex-1 flex-row items-center gap-3 py-3 pr-4 active:opacity-70 ${handle ? 'pl-1' : 'pl-3'}`}
        >
          <View
            className={`h-6 w-6 items-center justify-center rounded-full border-[1.5px] ${
              done ? 'border-good bg-good-soft' : 'border-edge'
            }`}
          >
            <Text className={`text-xs ${done ? 'text-good' : 'text-ink'}`}>{index + 1}</Text>
          </View>
          <Text className="flex-1 text-sm text-ink">{prescribed.exercise_name}</Text>
          {edited ? (
            <Text className="text-sm text-primary">{t('common.states.unsaved')}</Text>
          ) : (
            <Text className={`text-sm ${done ? 'text-good' : 'text-ink'}`}>{status(entry)}</Text>
          )}
          <ChevronIcon direction={open ? 'down' : 'right'} size={15} tint={color.ink} />
        </Pressable>
      </View>

      {open ? (
        <View className="gap-4 border-t border-line px-4 pb-4 pt-3">
          {prescribed.replaced_exercise_name ? (
            <Hint>{t('workouts.item.replacedOriginal', { day: word, name: prescribed.replaced_exercise_name })}</Hint>
          ) : null}

          <View className="gap-3">
            <Text className="text-sm text-muted">{t('workouts.item.record')}</Text>
            <SetRecordEditor entry={entry} rows={rows} onChange={onRowsChange} />
            {suggestion !== undefined ? (
              <View className="rounded-field bg-primary-soft p-3">
                {/* The next session reads this back from the logged effort; nothing to save. */}
                <Text className="text-base text-ink">{t('workouts.item.nextWeight', { weight: suggestion })}</Text>
              </View>
            ) : null}
          </View>

          <View className="gap-3">
            <Text className="text-sm text-muted">{t('workouts.item.target')}</Text>
            {prescribed.duration_sec ? (
              <Field
                label={t('workouts.item.targetTime')}
                suffix={t('common.units.minute')}
                value={target.durationMin}
                onChangeText={(durationMin) => set({ durationMin })}
                keyboardType="numeric"
              />
            ) : (
              <View className="flex-row gap-3">
                <Field
                  label={t('common.labels.sets')}
                  value={target.sets}
                  onChangeText={(sets) => set({ sets })}
                  keyboardType="numeric"
                />
                <Field label={t('common.labels.reps')} value={target.reps} onChangeText={(reps) => set({ reps })} />
              </View>
            )}
            <View className="flex-row gap-3">
              <Field
                label={t('common.labels.weight')}
                suffix="kg"
                value={target.weight}
                onChangeText={(weight) => set({ weight })}
                keyboardType="decimal-pad"
              />
              <Field
                label={t('common.labels.rest')}
                suffix={t('common.units.second')}
                value={target.rest}
                onChangeText={(rest) => set({ rest })}
                keyboardType="numeric"
              />
            </View>
            <Field label={t('common.labels.notes')} value={target.note} onChangeText={(note) => set({ note })} />
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1">
              <PrimaryButton tone="plain" onPress={onReplace} disabled={busy}>
                {t('workouts.item.changeExercise')}
              </PrimaryButton>
            </View>
            <View className="flex-1">
              <PrimaryButton tone="danger" onPress={onRemove} disabled={busy}>
                {t('common.actions.remove')}
              </PrimaryButton>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
