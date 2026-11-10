/**
 * One exercise in the day's workout, a row in the day's list. Closed, it reads as a summary line;
 * opened, it holds the exercise's sets for editing in place. Swapping it or taking it off the day
 * sits behind the row's ⋯, open or closed. Nothing is saved from here: the day's workout saves
 * every open change at once.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon, MoreIcon, SwapIcon, TrashIcon, type IconProps } from '@/components/icons';
import { CheckNumber } from '@/components/journal';
import { Text } from '@/components/text';
import { Sheet } from '@/components/Sheet';
import { Hint } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { color } from '@/theme/tokens';
import { type RecordRow } from '@/workouts/record';
import { SetRecordEditor } from '@/workouts/SetRecordEditor';

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
  const [menuOpen, setMenuOpen] = useState(false);
  // Let the sheet slide away first: iOS drops an alert presented while a modal is closing, and
  // removing asks before it deletes.
  const closeMenuThen = (action: () => void) => {
    setMenuOpen(false);
    setTimeout(action, 400);
  };

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
          className={`min-h-[66px] flex-1 flex-row items-center gap-3 py-3 pr-1 active:opacity-70 ${handle ? 'pl-1' : 'pl-3'}`}
        >
          <CheckNumber number={index + 1} done={done} />
          <Text className="flex-1 text-sm text-ink">{prescribed.exercise_name}</Text>
          {edited ? (
            <Text className="text-sm text-primary">{t('common.states.unsaved')}</Text>
          ) : (
            <Text className={`text-sm ${done ? 'text-good' : 'text-ink'}`}>{status(entry)}</Text>
          )}
          <ChevronIcon direction={open ? 'down' : 'right'} size={15} tint={color.ink} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workouts.item.moreActions', { name: prescribed.exercise_name })}
          disabled={busy}
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 11, bottom: 11 }}
          className="mr-1 h-11 w-11 items-center justify-center active:opacity-60"
        >
          <MoreIcon size={20} tint={color.ink} />
        </Pressable>
      </View>

      <Sheet visible={menuOpen} title={prescribed.exercise_name} onClose={() => setMenuOpen(false)}>
        <View className="gap-2 pb-4">
          <MenuOption icon={SwapIcon} label={t('workouts.item.changeExercise')} onPress={() => closeMenuThen(onReplace)} />
          <MenuOption icon={TrashIcon} label={t('workouts.item.removeFromDay', { day: word })} danger onPress={() => closeMenuThen(onRemove)} />
        </View>
      </Sheet>

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
        </View>
      ) : null}
    </View>
  );
}

/** One line in the row's ⋯ sheet. */
function MenuOption({
  icon: Icon,
  label,
  danger = false,
  onPress,
}: {
  icon: (props: IconProps) => ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3 rounded-control border-[1.5px] border-line bg-surface px-4 active:opacity-70"
    >
      <Icon size={18} tint={danger ? color.danger : color.ink} />
      <Text className={`text-base ${danger ? 'text-danger' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}
