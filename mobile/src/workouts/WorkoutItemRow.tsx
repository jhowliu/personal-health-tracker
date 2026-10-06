/**
 * One exercise in the day's workout. Closed, it reads as a summary line; opened, it holds the
 * exercise's target and its sets for editing in place. The ✕ takes it off the day. Nothing is
 * saved from here: the day's workout saves every open change at once.
 */
import { Pressable, Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon, CloseIcon } from '@/components/icons';
import { Field, Hint, TextAction } from '@/components/ui';
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
  if (isItemDone(entry)) return '✓ 完成';
  if (prescribed.duration_sec) return `${Math.round(prescribed.duration_sec / 60)} 分鐘`;
  if (entry.logs.length) return `${entry.logs.length} / ${prescribed.sets ?? 1} 組`;
  return `${prescribed.sets ?? 1} 組${prescribed.reps ? ` × ${prescribed.reps}` : ''}${
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
}) {
  const prescribed = entry.item;
  const done = isItemDone(entry);
  const set = (change: Partial<TargetEdit>) => onTargetChange({ ...target, ...change });

  return (
    <View
      className={`overflow-hidden rounded-card ${
        open ? 'border border-primary bg-surface' : done ? 'bg-good-soft' : 'bg-fill'
      }`}
    >
      <View className={`flex-row items-center ${open ? (done ? 'bg-good-soft' : 'bg-primary-soft') : ''}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${open ? '收起' : '修改'}${prescribed.exercise_name}`}
          accessibilityState={{ expanded: open, disabled: busy }}
          disabled={busy}
          onPress={onToggle}
          className="min-h-[58px] flex-1 flex-row items-center gap-2 pl-4 active:opacity-70"
        >
          <Text className="flex-1 text-base font-semibold text-ink">
            {index + 1}. {prescribed.exercise_name}
          </Text>
          {edited ? (
            <Text className="text-sm font-semibold text-primary">未儲存</Text>
          ) : (
            <Text className={`text-sm ${done ? 'font-semibold text-good' : 'text-muted'}`}>{status(entry)}</Text>
          )}
          <ChevronIcon direction={open ? 'up' : 'down'} size={14} tint={color.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除${prescribed.exercise_name}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onRemove}
          className="h-11 w-11 items-center justify-center active:opacity-60"
        >
          <CloseIcon size={18} tint={color.muted} />
        </Pressable>
      </View>

      {open ? (
        <View className="gap-4 px-4 pb-4 pt-3">
          {prescribed.replaced_exercise_name ? (
            <Hint>{word}已替換原本的 {prescribed.replaced_exercise_name}</Hint>
          ) : null}

          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted">目標</Text>
            {prescribed.duration_sec ? (
              <Field
                label="目標時間"
                suffix="分鐘"
                value={target.durationMin}
                onChangeText={(durationMin) => set({ durationMin })}
                keyboardType="numeric"
              />
            ) : (
              <View className="flex-row gap-3">
                <Field
                  label="組數"
                  value={target.sets}
                  onChangeText={(sets) => set({ sets })}
                  keyboardType="numeric"
                />
                <Field label="次數" value={target.reps} onChangeText={(reps) => set({ reps })} />
              </View>
            )}
            <View className="flex-row gap-3">
              <Field
                label="重量"
                suffix="kg"
                value={target.weight}
                onChangeText={(weight) => set({ weight })}
                keyboardType="decimal-pad"
              />
              <Field
                label="休息"
                suffix="秒"
                value={target.rest}
                onChangeText={(rest) => set({ rest })}
                keyboardType="numeric"
              />
            </View>
            <Field label="做法說明" value={target.note} onChangeText={(note) => set({ note })} />
            <TextAction label="換動作" disabled={busy} onPress={onReplace} className="min-h-[44px] justify-center self-start" />
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-muted">紀錄</Text>
            <SetRecordEditor entry={entry} rows={rows} onChange={onRowsChange} />
            {suggestion !== undefined ? (
              <View className="rounded-field bg-primary-soft p-3">
                {/* The next session reads this back from the logged effort; nothing to save. */}
                <Text className="text-base text-ink">下次會從 {suggestion} kg 開始</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
