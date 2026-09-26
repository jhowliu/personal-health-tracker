import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { DaySummary } from '@/components/DaySummary';
import { STEP_LABEL, StepIndicator } from '@/components/StepIndicator';
import { Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

type Today = Schema<'TodayOut'>;
type PlannedMealItem = {
  id: string;
  food: Schema<'FoodOut'> | null;
  category_id: string | null;
  custom_name: string | null;
  grams: number | null;
  nutrients: Schema<'NutrientsOut'>;
};
// These fields exist in the updated contract, but are absent from the checked-in generated types.
type PlannedMeal = {
  meal_time: string;
  meal_id: string | null;
  name: string;
  eaten: boolean;
  skipped: boolean;
  items: PlannedMealItem[];
  nutrients: Schema<'NutrientsOut'>;
};
type DayPlan = Omit<Schema<'DayPlanOut'>, 'meals'> & { meals: PlannedMeal[] };
type WorkoutItem = Schema<'WorkoutExecutionItemOut'>;
type Workout = Schema<'WorkoutExecutionOut'>;
type SetEffort = 'easy' | 'appropriate' | 'hard';
type SetLogResult = { next_weight_kg: number | null };
type WorkoutEdit = { sets: string; reps: string; durationMin: string; weight: string; rest: string; note: string };

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const [day, setDay] = useState<Today | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [weighIn, setWeighIn] = useState({ weight: '', waist: '' });
  const date = todayISO();

  const load = useCallback(async (resetStep = false) => {
    try {
      const fresh = await api.get(`/days/${date}`);
      setDay(fresh);
      if (resetStep) setViewing(null);
    } catch (error) {
      Alert.alert('讀不到今天的資料', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [date]);

  const refreshAt = useCallback(
    async (step: string) => {
      try {
        setDay(await api.get(`/days/${date}`));
        setViewing(step);
      } catch (error) {
        Alert.alert('讀不到今天的資料', error instanceof ApiError ? error.message : '請稍後再試');
      }
    },
    [date],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!day) {
    return (
      <Screen scroll={false} footerSafeArea={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const step = viewing ?? day.flow.current;
  const header = <TodayHeader day={day} step={step} onSelect={setViewing} />;

  if (step === 'body') {
    return (
      <WeighInStep
        header={header}
        date={day.date}
        value={weighIn}
        onChange={setWeighIn}
        onSaved={() => {
          setWeighIn({ weight: '', waist: '' });
          return load(true);
        }}
      />
    );
  }
  if (step === 'done') {
    return (
      <Screen footerSafeArea={false}>
        {header}
        <DoneStep day={day} />
      </Screen>
    );
  }
  if (step === 'workout') {
    return (
      <WorkoutStep
        header={header}
        date={day.date}
        onDone={() => load(true)}
        onStateChanged={() => refreshAt('workout')}
      />
    );
  }
  return (
    <MealStep
      header={header}
      step={step}
      day={day}
      onDone={() => load(true)}
      onStateChanged={() => refreshAt(step)}
    />
  );
}

function TodayHeader({
  day,
  step,
  onSelect,
}: {
  day: Today;
  step: string;
  onSelect: (step: string) => void;
}) {
  const parsed = new Date(`${day.date}T00:00:00`);
  return (
    <View className="gap-3 pb-3">
      <View className="items-center">
        <Text className="font-display text-lg font-bold text-ink">
          {parsed.getMonth() + 1} 月 {parsed.getDate()} 日 {WEEKDAY[parsed.getDay()]}
        </Text>
        {day.streak > 0 ? <Text className="text-sm text-muted">連續 {day.streak} 天</Text> : null}
      </View>
      <DaySummary eaten={day.flow.eaten} targets={day.targets} />
      <StepIndicator
        steps={day.flow.steps}
        completed={day.flow.completed}
        current={step}
        onSelect={onSelect}
      />
    </View>
  );
}

function WeighInStep({
  header,
  date,
  value,
  onChange,
  onSaved,
}: {
  header: ReactNode;
  date: string;
  value: { weight: string; waist: string };
  onChange: (value: { weight: string; waist: string }) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { weight, waist } = value;

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/body-logs/${date}`, {
        weight_kg: weight ? Number(weight) : null,
        waist_cm: waist ? Number(waist) : null,
      });
      onSaved();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footerSafeArea={false}
      footer={
        <PrimaryButton onPress={save} disabled={!weight && !waist} busy={busy}>
          {busy ? '儲存中…' : '儲存,下一步:早餐'}
        </PrimaryButton>
      }
    >
      {header}
      <View className="gap-4">
      <View className="gap-1">
        <Hint>起床、上完廁所、還沒吃喝前</Hint>
        <Title>早安,先量一下</Title>
      </View>

      <Card className="gap-3">
        <View className="flex-row gap-3">
          <Field
            label="體重"
            suffix="kg"
            value={weight}
            onChangeText={(next) => onChange({ ...value, weight: next })}
            keyboardType="decimal-pad"
          />
          <Field
            label="腰圍(選填)"
            suffix="cm"
            value={waist}
            onChangeText={(next) => onChange({ ...value, waist: next })}
            keyboardType="decimal-pad"
          />
        </View>
        <Hint>腰圍量肚臍那一圈,自然吐氣時讀數字。一週量一次就好。</Hint>
      </Card>

      </View>
    </Screen>
  );
}

function MealStep({
  header,
  step,
  day,
  onDone,
  onStateChanged,
}: {
  header: ReactNode;
  step: string;
  day: Today;
  onDone: () => void;
  onStateChanged: () => void;
}) {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [grams, setGrams] = useState('');

  const load = useCallback(async () => {
    try {
      setPlan((await api.get(`/days/${day.date}/plan`)) as unknown as DayPlan);
    } catch (error) {
      Alert.alert('讀不到今天的餐點', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [day.date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const meal = plan?.meals.find((m) => m.meal_time === step);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      await load();
      return true;
    } catch (error) {
      Alert.alert('沒有成功', error instanceof ApiError ? error.message : '請稍後再試');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setMealState = async (state: 'eaten' | 'skipped' | 'planned') => {
    const saved = await act(() => api.patch(`/days/${day.date}/meals/${step}`, { state }));
    if (saved) {
      if (state === 'eaten') onDone();
      else onStateChanged();
    }
  };

  if (!plan) {
    return (
      <Screen footerSafeArea={false}>
        {header}
        <View className="items-center py-12">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  if (!meal) {
    return (
      <Screen
        footerSafeArea={false}
        footer={
          <>
            <PrimaryButton onPress={() => setMealState('eaten')} busy={busy}>
              {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完`}
            </PrimaryButton>
            <PrimaryButton tone="plain" onPress={() => setMealState('skipped')} disabled={busy}>
              今天略過這餐
            </PrimaryButton>
          </>
        }
      >
        {header}
        <View className="gap-4">
          <Title sub="還沒有適合這個時段的餐點">{STEP_LABEL[step]}</Title>
          <Card className="gap-2">
            <Text className="text-base text-ink">
              可以直接加入今天吃的已知食物，或到「餐點」分頁新增標記為{STEP_LABEL[step]}的餐點，之後每天會自動排進來。
            </Text>
          </Card>
          <PrimaryButton
            tone="plain"
            onPress={() => router.navigate(`/meals/add-food?destination=day&date=${day.date}&slot=${step}`)}
            disabled={busy}
          >
            ＋ 加入食物
          </PrimaryButton>
        </View>
      </Screen>
    );
  }

  const footer = (
    <>
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm text-muted">本餐</Text>
        <Text className="font-display text-xl font-bold text-ink">
          {meal.skipped ? '未計入' : `${Math.round(meal.nutrients.kcal)} 大卡`}
        </Text>
      </View>
      {meal.skipped ? (
        <>
          <PrimaryButton onPress={() => setMealState('eaten')} busy={busy}>
            {busy ? '處理中…' : '仍要標記吃完'}
          </PrimaryButton>
          <PrimaryButton tone="plain" onPress={() => setMealState('planned')} disabled={busy}>
            改回未吃
          </PrimaryButton>
        </>
      ) : meal.eaten ? (
        <>
          <Hint>這餐已標記吃完。</Hint>
          <PrimaryButton tone="plain" onPress={() => setMealState('planned')} disabled={busy}>
            改回未吃
          </PrimaryButton>
        </>
      ) : (
        <>
          <PrimaryButton onPress={() => setMealState('eaten')} busy={busy}>
            {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完`}
          </PrimaryButton>
          <PrimaryButton tone="plain" onPress={() => setMealState('skipped')} disabled={busy}>
            今天略過這餐
          </PrimaryButton>
        </>
      )}
    </>
  );

  return (
    <Screen footerSafeArea={false} footer={footer}>
      {header}
      <View className="gap-4">
      <View className="gap-1">
        <Hint>今天的{STEP_LABEL[step]}</Hint>
        <Title>{meal.name}</Title>
      </View>

      {meal.skipped ? (
        <Card className="gap-2 bg-fill">
          <Text className="text-base font-semibold text-ink">這餐已略過</Text>
          <Hint>不會計入今天的熱量和流程。</Hint>
        </Card>
      ) : (
        <>
          <Card className="gap-3">
            {groupPlanItems(meal.items).map((group) => (
              <View key={group.category} className="gap-2">
                <Text className="text-sm text-muted">{group.label}</Text>
                {group.items.map((item) => {
                  const food = item.food;
                  const itemName = item.food?.name ?? item.custom_name ?? '未命名食物';
                  const canEditGrams = food !== null && item.grams !== null;
                  return (
                    <View key={item.id} className="gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-1 text-base text-ink">{formatPlanItem(item)}</Text>
                        {food && item.grams !== null ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`換掉${itemName}`}
                            onPress={() =>
                              router.navigate(
                                `/meals/swap-today?date=${day.date}&slot=${step}&item=${item.id}&food=${food.id}&grams=${item.grams}`,
                              )
                            }
                            className="min-h-[44px] justify-center rounded-field bg-fill px-3"
                          >
                            <Text className="text-base text-ink">換</Text>
                          </Pressable>
                        ) : null}
                        {canEditGrams ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              setEditingItem(item.id);
                              setGrams(String(Math.round(item.grams!)));
                            }}
                            className="min-h-[44px] justify-center px-1"
                          >
                            <Text className="text-base text-primary">改</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`刪除${itemName}`}
                          disabled={busy}
                          onPress={() =>
                            act(() => api.delete(`/days/${day.date}/plan/${step}/items/${item.id}`))
                          }
                          className="min-h-[44px] justify-center px-1"
                        >
                          <Text className="text-base text-primary">刪除</Text>
                        </Pressable>
                      </View>
                      {editingItem === item.id ? (
                        <View className="flex-row items-end gap-2">
                          <Field label="份量" value={grams} onChangeText={setGrams} suffix="g" keyboardType="decimal-pad" />
                          <Pressable
                            accessibilityRole="button"
                            disabled={busy || !Number(grams)}
                            onPress={() =>
                              act(() => api.patch(`/days/${day.date}/plan/${step}/items/${item.id}`, { grams: Number(grams) }))
                            }
                            className="min-h-[44px] justify-center px-1"
                          >
                            <Text className="text-base font-semibold text-primary">儲存</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
            <View className="flex-row items-baseline justify-between border-t border-line pt-3">
              <Text className="text-base font-semibold text-ink">整份</Text>
              <Text className="text-base font-semibold text-ink">{Math.round(meal.nutrients.kcal)} 大卡</Text>
            </View>
          </Card>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => act(() => api.post(`/days/${day.date}/plan/shuffle`, { meal_time: step }))}
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="text-base text-primary underline">整道換掉</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => router.navigate(`/meals/add-food?destination=day&date=${day.date}&slot=${step}`)}
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="text-base text-primary underline">＋ 加入食物</Text>
          </Pressable>
        </>
      )}

      </View>
    </Screen>
  );
}

function groupPlanItems(items: PlannedMealItem[]) {
  const labels: Record<string, string> = {
    staple: '主食',
    protein: '蛋白質',
    vegetable: '蔬菜',
    fruit: '水果',
    fat_sauce: '油脂與醬料',
  };
  const groups = new Map<string, PlannedMealItem[]>();
  for (const item of items) {
    const category = item.category_id ?? 'other';
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups].map(([category, groupedItems]) => ({
    category,
    label: labels[category] ?? '其他',
    items: groupedItems,
  }));
}

function formatPlanItem(item: PlannedMealItem) {
  const name = item.food?.name ?? item.custom_name ?? '未命名食物';
  if (item.grams === null) return name;
  const { grams_per_unit, unit } = item.food ?? {};
  if (grams_per_unit && unit === 'piece') return `${name} ${Math.round(item.grams / grams_per_unit)} 顆`;
  if (grams_per_unit && unit === 'scoop') {
    const scoops = item.grams / grams_per_unit;
    return `${name} ${scoops % 1 === 0 ? scoops : scoops.toFixed(1)} 匙`;
  }
  if (unit === 'ml' && grams_per_unit) return `${name} ${Math.round(item.grams / grams_per_unit)} ml`;
  return `${name} ${Math.round(item.grams)} g`;
}

function WorkoutStep({
  header,
  date,
  onDone,
  onStateChanged,
}: {
  header: ReactNode;
  date: string;
  onDone: () => void;
  onStateChanged: () => void;
}) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [edit, setEdit] = useState<WorkoutEdit | null>(null);
  const [workoutSkipped, setWorkoutSkipped] = useState(false);
  const [pendingEffort, setPendingEffort] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, number>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setWorkout(await api.get(`/days/${date}/workout`));
      setPendingEffort(null);
    } catch (error) {
      Alert.alert('讀不到今天的訓練', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const logSet = async (item: WorkoutItem, setIndex: number, effort?: SetEffort) => {
    const prescribed = item.item;
    // Timed work records what actually happened, which is rarely the planned number.
    const typed = minutes[prescribed.id];
    const durationSec = prescribed.duration_sec
      ? Math.max(1, Number(typed ?? Math.round(prescribed.duration_sec / 60)) || 1) * 60
      : null;
    setBusy(true);
    try {
      const result = (await api.put(`/days/${date}/workout/sets`, {
        day_workout_item_id: prescribed.id,
        exercise_id: prescribed.exercise_id,
        set_index: setIndex,
        duration_sec: durationSec,
        weight_kg: prescribed.weight_kg,
        effort,
      })) as SetLogResult;
      const nextWeight = result.next_weight_kg;
      if (nextWeight !== null) {
        setSuggestions((current) => ({ ...current, [prescribed.id]: nextWeight }));
      }
      await load();
    } catch (error) {
      Alert.alert('記錄不了這一組', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const applySuggestion = async (item: WorkoutItem) => {
    const templateId = workout?.template?.id;
    const nextWeight = suggestions[item.item.id];
    // Writing back needs the template row this was copied from; a day-only item has none.
    const sourceItemId = item.item.source_item_id;
    if (!templateId || !sourceItemId || nextWeight === undefined) return;
    setBusy(true);
    try {
      await api.put(`/workout-templates/${templateId}/items/${sourceItemId}/weight`, {
        weight_kg: nextWeight,
      });
      setSuggestions((current) => {
        const { [item.item.id]: _, ...rest } = current;
        return rest;
      });
    } catch (error) {
      Alert.alert('套用不了重量', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await api.patch(`/days/${date}`, { workout_done: true });
      onDone();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item: WorkoutItem) => {
    const prescribed = item.item;
    setEditingItem(prescribed.id);
    setEdit({
      sets: String(prescribed.sets ?? ''),
      reps: prescribed.reps ?? '',
      durationMin: prescribed.duration_sec ? String(Math.round(prescribed.duration_sec / 60)) : '',
      weight: prescribed.weight_kg === null ? '' : String(prescribed.weight_kg),
      rest: String(prescribed.rest_sec),
      note: prescribed.note ?? '',
    });
  };

  const saveEdit = async (item: WorkoutItem) => {
    if (!edit) return;
    const prescribed = item.item;
    const common = {
      weight_kg: edit.weight ? Number(edit.weight) : null,
      rest_sec: Math.max(0, Number(edit.rest) || 0),
      note: edit.note || null,
    };
    const changes = prescribed.duration_sec
      ? { ...common, duration_sec: Math.max(1, Number(edit.durationMin) || 1) * 60 }
      : { ...common, sets: Math.max(1, Number(edit.sets) || 1), reps: edit.reps };
    setBusy(true);
    try {
      await api.patch(`/days/${date}/workout/items/${prescribed.id}`, changes);
      setEditingItem(null);
      setEdit(null);
      await load();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = (item: WorkoutItem) =>
    Alert.alert('刪除動作', `確定移除「${item.item.exercise_name}」？這只會影響今天的訓練。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/days/${date}/workout/items/${item.item.id}`);
            await load();
          } catch (error) {
            Alert.alert('刪除不了動作', error instanceof ApiError ? error.message : '請稍後再試');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const skipWorkout = async () => {
    setBusy(true);
    try {
      await api.patch(`/days/${date}`, { workout_skipped: true });
      setWorkoutSkipped(true);
      onStateChanged();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  if (!workout) {
    return (
      <Screen footerSafeArea={false}>
        {header}
        <View className="items-center py-12">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const allComplete = workout.items.every((entry) => completedSetCount(entry) >= (entry.item.sets ?? 1));
  const completedExercises = workout.items.filter(
    (entry) => completedSetCount(entry) >= (entry.item.sets ?? 1),
  ).length;
  const templateName = workout.template?.name;

  return (
    <Screen
      footerSafeArea={false}
      footer={
        <>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">完成進度</Text>
            <Text className="text-base font-semibold text-ink">
              {completedExercises} / {workout.items.length} 個動作
            </Text>
          </View>
          {workoutSkipped ? (
            <PrimaryButton onPress={complete} busy={busy}>
              仍要完成今日訓練
            </PrimaryButton>
          ) : allComplete && workout.items.length > 0 ? (
            <PrimaryButton onPress={complete} busy={busy}>
              {busy ? '處理中…' : '完成今日訓練'}
            </PrimaryButton>
          ) : (
            <PrimaryButton tone="plain" onPress={skipWorkout} busy={busy}>
              {busy ? '處理中…' : '今天不練'}
            </PrimaryButton>
          )}
        </>
      }
    >
      {header}
      <View className="gap-4">
        <Title sub={templateName ? `今天的課表：${templateName}` : '今天沒有排定訓練'}>運動</Title>

      {workoutSkipped ? (
        <Card className="gap-3 bg-fill">
          <View className="gap-1">
            <Text className="text-base font-semibold text-ink">今天已略過訓練</Text>
            <Hint>略過已儲存。若後來完成了訓練，可直接標記完成。</Hint>
          </View>
        </Card>
      ) : (
        <>
          {workout.items.map((item, itemIndex) => {
        const prescribed = item.item;
        const setCount = prescribed.sets ?? 1;
        const completed = completedSetCount(item);
        const ungrouped = prescribed.sets === null;
        const suggestion = suggestions[prescribed.id];

        return (
          <Card key={prescribed.id} className="gap-3">
            <View className="gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-base font-semibold text-ink">
                  {itemIndex + 1}. {prescribed.exercise_name}
                </Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => startEdit(item)}>
                  <Text className="text-base text-primary">編輯</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => deleteItem(item)}>
                  <Text className="text-base text-primary">刪除</Text>
                </Pressable>
              </View>
              <Hint>
                {prescribed.duration_sec
                  ? `${Math.round(prescribed.duration_sec / 60)} 分鐘`
                  : ungrouped
                    ? prescribed.reps
                    : `${setCount} 組 × ${prescribed.reps}`}
                {prescribed.weight_kg !== null ? ` · ${prescribed.weight_kg} kg` : ''}
              </Hint>
              {prescribed.replaced_exercise_name ? (
                <Hint>今天已替換原本的 {prescribed.replaced_exercise_name}</Hint>
              ) : null}
              {prescribed.note ? <Hint>{prescribed.note}</Hint> : null}
            </View>

            {editingItem === prescribed.id && edit ? (
              <View className="gap-3 rounded-field bg-fill p-3">
                {prescribed.duration_sec ? (
                  <Field
                    label="時間"
                    suffix="分鐘"
                    value={edit.durationMin}
                    onChangeText={(durationMin) => setEdit((current) => current && { ...current, durationMin })}
                    keyboardType="numeric"
                  />
                ) : (
                  <View className="flex-row gap-3">
                    <Field
                      label="組數"
                      value={edit.sets}
                      onChangeText={(sets) => setEdit((current) => current && { ...current, sets })}
                      keyboardType="numeric"
                    />
                    <Field
                      label="次數"
                      value={edit.reps}
                      onChangeText={(reps) => setEdit((current) => current && { ...current, reps })}
                    />
                  </View>
                )}
                <View className="flex-row gap-3">
                  <Field
                    label="重量"
                    suffix="kg"
                    value={edit.weight}
                    onChangeText={(weight) => setEdit((current) => current && { ...current, weight })}
                    keyboardType="decimal-pad"
                  />
                  <Field
                    label="休息"
                    suffix="秒"
                    value={edit.rest}
                    onChangeText={(rest) => setEdit((current) => current && { ...current, rest })}
                    keyboardType="numeric"
                  />
                </View>
                <Field
                  label="做法說明"
                  value={edit.note}
                  onChangeText={(note) => setEdit((current) => current && { ...current, note })}
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <PrimaryButton tone="plain" onPress={() => { setEditingItem(null); setEdit(null); }} disabled={busy}>
                      取消
                    </PrimaryButton>
                  </View>
                  <View className="flex-1">
                    <PrimaryButton onPress={() => saveEdit(item)} disabled={busy || (!prescribed.duration_sec && !edit.reps)}>
                      儲存
                    </PrimaryButton>
                  </View>
                </View>
              </View>
            ) : null}

            {prescribed.duration_sec ? (
              <Field
                label="實際時間"
                suffix="分鐘"
                value={minutes[prescribed.id] ?? String(Math.round(prescribed.duration_sec / 60))}
                onChangeText={(text) =>
                  setMinutes((current) => ({ ...current, [prescribed.id]: text }))
                }
                keyboardType="numeric"
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                router.navigate(
                  `/workouts/replace-today?date=${date}&item_id=${prescribed.id}&exercise_id=${prescribed.exercise_id}&name=${encodeURIComponent(prescribed.exercise_name)}`,
                )
              }
              className="min-h-[44px] justify-center"
            >
              <Text className="text-base text-primary">換動作</Text>
            </Pressable>

            {ungrouped ? (
              <PrimaryButton onPress={() => logSet(item, 0)} disabled={busy || completed > 0} tone="plain">
                {completed > 0 ? '已完成' : '完成這個動作'}
              </PrimaryButton>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {Array.from({ length: setCount }, (_, setIndex) => {
                  const done = setIndex < completed;
                  const final = setIndex === setCount - 1;
                  const available = setIndex === completed;
                  return (
                    <Pressable
                      key={setIndex}
                      accessibilityRole="button"
                      accessibilityState={{ selected: done }}
                      disabled={busy || done || !available}
                      onPress={() => (final ? setPendingEffort(prescribed.id) : logSet(item, setIndex))}
                      className={`min-h-[44px] min-w-[72px] items-center justify-center rounded-field px-3 ${
                        done ? 'bg-good-soft' : 'bg-fill'
                      } ${busy || !available ? 'opacity-40' : ''}`}
                    >
                      <Text className={`text-base ${done ? 'text-good' : 'text-ink'}`}>{done ? `第 ${setIndex + 1} 組 ✓` : `第 ${setIndex + 1} 組`}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {pendingEffort === prescribed.id ? (
              <View className="gap-2">
                <Hint>最後一組感覺如何？</Hint>
                <View className="flex-row gap-2">
                  {([
                    ['easy', '輕鬆'],
                    ['appropriate', '剛好'],
                    ['hard', '吃力'],
                  ] as const).map(([effort, label]) => (
                    <Chip
                      key={effort}
                      label={label}
                      onPress={() => logSet(item, setCount - 1, effort)}
                      tone={effort === 'hard' ? 'warm' : effort === 'easy' ? 'good' : 'primary'}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {suggestion !== undefined ? (
              <View className="gap-2 rounded-field bg-primary-soft p-3">
                <Text className="text-base text-ink">下次建議 {suggestion} kg</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => applySuggestion(item)}
                  className="min-h-[44px] justify-center"
                >
                  <Text className="text-base font-semibold text-primary">套用到課表</Text>
                </Pressable>
              </View>
            ) : null}
          </Card>
        );
          })}

      {workout.estimated_burn_kcal ? (
        <Hint>
          今天訓練約消耗 {workout.estimated_burn_kcal} 大卡。這是依動作強度和課表時間的粗估,
          沒有算進你的熱量目標——目標裡的活動量已經含了訓練。
        </Hint>
      ) : null}

          {workout.items.length === 0 ? <Hint>今天沒有安排訓練。</Hint> : null}

          <PrimaryButton tone="plain" onPress={() => router.navigate(`/workouts/add-today?date=${date}`)} disabled={busy}>
            ＋ 加入動作
          </PrimaryButton>
        </>
      )}
      </View>
    </Screen>
  );
}

function completedSetCount(item: WorkoutItem) {
  return item.logs.length || item.completed_set_count;
}

function DoneStep({ day }: { day: Today }) {
  const remaining = day.targets.kcal - day.flow.eaten.kcal;

  return (
    <View className="flex-1 gap-4">
      <Title sub="今天的流程都走完了">辛苦了</Title>

      <Card className="gap-3">
        <Text className="font-display text-4xl font-bold text-ink">
          {Math.round(day.flow.eaten.kcal).toLocaleString()}{' '}
          <Text className="text-base font-normal text-muted">
            / {day.targets.kcal.toLocaleString()} 大卡
          </Text>
        </Text>
        <Text className={`text-base ${remaining >= 0 ? 'text-good' : 'text-warm'}`}>
          {remaining >= 0
            ? `還有 ${Math.round(remaining)} 大卡的空間`
            : `超過 ${Math.round(-remaining)} 大卡`}
        </Text>
        {day.streak > 0 ? <Hint>連續 {day.streak} 天完成流程。</Hint> : null}
      </Card>

      <Pressable accessibilityRole="button">
        <Hint>想改哪一步,點上面的進度列回去。</Hint>
      </Pressable>
    </View>
  );
}
