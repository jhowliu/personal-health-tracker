/**
 * One exercise's sets, typed in after the fact: a row per set with its reps and weight, or the
 * minutes for timed work. Sets are added and removed freely; nothing is saved from here.
 */
import { Pressable, Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { Chip, Field, Hint, TextAction } from '@/components/ui';
import { color } from '@/theme/tokens';
import { isTimed, nextRow, prescribedRows, type Effort, type RecordRow } from '@/workouts/record';

const EFFORTS: readonly (readonly [Effort, string, 'good' | 'primary' | 'warm'])[] = [
  ['easy', '輕鬆', 'good'],
  ['appropriate', '剛好', 'primary'],
  ['hard', '吃力', 'warm'],
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
  const timed = isTimed(entry);
  const bodyweight = entry.item.equipment === 'bodyweight';
  const update = (index: number, change: Partial<RecordRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const remove = (index: number) => onChange(rows.filter((_, at) => at !== index));
  const last = rows[rows.length - 1];

  if (timed) {
    return rows.length ? (
      <View className="flex-row items-end gap-2">
        <Field
          label="實際時間"
          suffix="分鐘"
          value={rows[0].minutes}
          onChangeText={(minutes) => update(0, { minutes })}
          keyboardType="number-pad"
          selectTextOnFocus
        />
        <RemoveButton label="清除時間" onPress={() => remove(0)} />
      </View>
    ) : (
      <TextAction
        icon={PlusIcon}
        label={`記錄時間（目標 ${Math.round((entry.item.duration_sec ?? 60) / 60)} 分鐘）`}
        onPress={() => onChange(prescribedRows(entry))}
        className="min-h-[44px] justify-center self-start"
      />
    );
  }

  return (
    <View className="gap-2">
      {rows.map((row, index) => (
        <View key={index} className="flex-row items-center gap-2">
          <Text className="w-12 text-sm text-muted">第 {index + 1} 組</Text>
          <Field
            accessibilityLabel={`第 ${index + 1} 組次數`}
            suffix="下"
            value={row.reps}
            onChangeText={(reps) => update(index, { reps })}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Field
            accessibilityLabel={`第 ${index + 1} 組重量`}
            suffix="kg"
            placeholder={bodyweight ? '自重' : '選填'}
            value={row.weight}
            onChangeText={(weight) => update(index, { weight })}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <RemoveButton label={`刪除第 ${index + 1} 組`} onPress={() => remove(index)} />
        </View>
      ))}

      <View className="flex-row flex-wrap items-center gap-x-6">
        <TextAction
          icon={PlusIcon}
          label="新增一組"
          onPress={() => onChange([...rows, nextRow(entry, rows)])}
          className="min-h-[44px] justify-center"
        />
        {rows.length === 0 && (entry.item.sets ?? 1) > 1 ? (
          <TextAction
            label={`照目標填入 ${entry.item.sets} 組`}
            onPress={() => onChange(prescribedRows(entry))}
            className="min-h-[44px] justify-center"
          />
        ) : null}
      </View>

      {last ? (
        <View className="gap-1">
          <Hint>最後一組感覺如何？（選填，用來建議下次的重量）</Hint>
          <View className="flex-row gap-2">
            {EFFORTS.map(([effort, label, tone]) => (
              <Chip
                key={effort}
                label={label}
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
