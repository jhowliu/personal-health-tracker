import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { defaultExercisePrescription, ExerciseLibrary, type Exercise } from '@/components/ExerciseLibrary';
import { NumberStepper } from '@/components/NumberStepper';
import {
  Card,
  Field,
  Hint,
  PrimaryButton,
  Screen,
  Segmented,
  SectionHeading,
  Title,
} from '@/components/ui';
import { color } from '@/theme/tokens';
import { replacement } from '@/workouts/replacement';

type Template = Schema<'TemplateOut'>;
type Draft = {
  id: string | null;
  exercise_id: string;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  weight_kg: number | null;
  rest_sec: number;
  note: string | null;
};

export default function EditTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [items, setItems] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!isNew) {
          const template: Template = await api.get(`/workout-templates/${id}`);
          setName(template.name);
          setDuration(template.duration_min ? String(template.duration_min) : '');
          setItems(template.items.map((item) => ({ ...item })));
        }
      } catch (error) {
        Alert.alert('讀不到課表', error instanceof ApiError ? error.message : '請稍後再試');
      } finally {
        setReady(true);
      }
    })();
  }, [id, isNew]);

  useEffect(
    () =>
      replacement.subscribe(() => {
        const selected = replacement.take();
        if (!selected) return;
        setItems((current) =>
          current.map((item, index) =>
            index === selected.index
              ? { ...item, exercise_id: selected.exercise_id, exercise_name: selected.exercise_name }
              : item,
          ),
        );
      }),
    [],
  );

  const move = (index: number, delta: number) => {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setEditing(editing === index ? target : editing === target ? index : editing);
  };

  const patch = (index: number, changes: Partial<Draft>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const addFromLibrary = (exercise: Exercise) => {
    const defaults = defaultExercisePrescription(exercise.category_id);
    setItems([
      ...items,
      {
        id: null,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        ...defaults,
        note: null,
      },
    ]);
    setEditing(items.length);
    setLibraryOpen(false);
  };

  const save = async () => {
    setBusy(true);
    const body = {
      category_id: 'strength',
      name,
      duration_min: duration ? Number(duration) : null,
      items: items.map((item) => ({
        id: item.id,
        exercise_id: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        duration_sec: item.duration_sec,
        weight_kg: item.weight_kg,
        rest_sec: item.rest_sec,
        note: item.note,
      })),
    };
    try {
      if (isNew) await api.post('/workout-templates', body);
      else await api.put(`/workout-templates/${id}`, body);
      router.back();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ 訓練</Text>
      </Pressable>

      <Title>{isNew ? '新增課表' : '編輯課表'}</Title>

      <Field label="課表名稱" value={name} onChangeText={setName} placeholder="健身房:下肢" />

      <Field
        label="大約時間"
        suffix="分鐘"
        value={duration}
        onChangeText={setDuration}
        keyboardType="numeric"
      />
      <Hint>地點依動作用到的器材自動判定:出現槓鈴、機械、滑輪或跑步機就算健身房。</Hint>

      <SectionHeading action={<Text className="text-sm text-muted">{items.length} 個</Text>}>
        動作
      </SectionHeading>

      {items.map((item, index) =>
        editing === index ? (
          <Card key={`${item.exercise_id}-${index}`} className="gap-3 border-primary">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-ink">
                {index + 1}. {item.exercise_name}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setItems(items.filter((_, i) => i !== index));
                  setEditing(null);
                }}
              >
                <Text className="text-base text-primary">刪除</Text>
              </Pressable>
            </View>

            <Segmented
              value={item.duration_sec === null ? 'reps' : 'time'}
              onChange={(mode) =>
                patch(
                  index,
                  mode === 'time'
                    ? { duration_sec: item.duration_sec ?? 1200, reps: null, sets: null }
                    : { duration_sec: null, reps: item.reps ?? '10-12', sets: item.sets ?? 3 },
                )
              }
              options={[
                { value: 'reps', label: '次數' },
                { value: 'time', label: '時間' },
              ]}
            />

            {item.duration_sec === null ? (
              <View className="flex-row items-end gap-3">
                <View className="gap-1">
                  <Text className="text-sm text-muted">組數</Text>
                  <NumberStepper
                    value={item.sets ?? 1}
                    onChange={(sets) => patch(index, { sets })}
                  />
                </View>
                <Field
                  label="次數"
                  value={item.reps ?? ''}
                  onChangeText={(reps) => patch(index, { reps })}
                  placeholder="10-12"
                />
                <Field
                  label="重量"
                  suffix="kg"
                  value={item.weight_kg === null ? '' : String(item.weight_kg)}
                  onChangeText={(text) => patch(index, { weight_kg: text ? Number(text) : null })}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : (
              <Field
                label="時間"
                suffix="分鐘"
                value={String(Math.round(item.duration_sec / 60))}
                onChangeText={(text) =>
                  patch(index, { duration_sec: Math.max(1, Number(text) || 1) * 60 })
                }
                keyboardType="numeric"
              />
            )}

            <Field
              label="做法說明"
              value={item.note ?? ''}
              onChangeText={(note) => patch(index, { note: note || null })}
              placeholder="腳與肩同寬,膝蓋不要完全打直"
            />

            <Field
              label="休息"
              value={String(item.rest_sec)}
              onChangeText={(text) => patch(index, { rest_sec: Number(text) || 0 })}
              suffix="秒"
              keyboardType="numeric"
            />

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push(
                  `/workouts/alternatives?exercise_id=${item.exercise_id}&item_index=${index}&name=${encodeURIComponent(item.exercise_name)}`,
                )
              }
            >
              <Text className="text-base text-primary">找替代動作</Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => setEditing(null)}>
              <Text className="text-center text-base text-muted">收起</Text>
            </Pressable>
          </Card>
        ) : (
          <Pressable
            key={`${item.exercise_id}-${index}`}
            accessibilityRole="button"
            onPress={() => setEditing(index)}
            className="min-h-[44px] flex-row items-center gap-2 rounded-card border border-line bg-surface p-3"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-semibold text-ink">
                {index + 1}. {item.exercise_name}
              </Text>
              <Text className="text-sm text-muted">
                {item.duration_sec
                  ? `${Math.round(item.duration_sec / 60)} 分鐘`
                  : item.sets
                    ? `${item.sets} 組 × ${item.reps}`
                    : item.reps}
                {item.weight_kg ? `,${item.weight_kg} kg` : ''}
              </Text>
            </View>
            <Arrow label="上移" onPress={() => move(index, -1)} disabled={index === 0} glyph="↑" />
            <Arrow
              label="下移"
              onPress={() => move(index, 1)}
              disabled={index === items.length - 1}
              glyph="↓"
            />
          </Pressable>
        ),
      )}

      {items.length === 0 ? <Hint>還沒有動作,從下面加入。</Hint> : null}

       <PrimaryButton tone="plain" onPress={() => setLibraryOpen((open) => !open)}>
         {libraryOpen ? '收起動作庫' : '+ 從動作庫加入'}
       </PrimaryButton>

        {libraryOpen ? <ExerciseLibrary onSelect={addFromLibrary} /> : null}

      <PrimaryButton onPress={save} disabled={busy || !name || items.length === 0}>
        {busy ? '儲存中…' : '儲存課表'}
      </PrimaryButton>
    </Screen>
  );
}

function Arrow({
  label,
  glyph,
  onPress,
  disabled,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      className={`h-11 w-11 items-center justify-center rounded-field border border-line ${
        disabled ? 'opacity-30' : ''
      }`}
    >
      <Text className="text-base text-ink">{glyph}</Text>
    </Pressable>
  );
}
