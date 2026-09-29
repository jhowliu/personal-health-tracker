import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api, type Schema } from '@/api/client';
import { AppModal } from '@/components/AppModal';
import { DaySummary } from '@/components/DaySummary';
import { FoodCategoryIcon } from '@/components/FoodCategoryIcon';
import { CheckIcon, ChevronIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { STEP_LABEL, StepIndicator } from '@/components/StepIndicator';
import { Card, Chip, Empty, Field, Hint, PrimaryButton, Screen, TextAction, Title } from '@/components/ui';
import { amountToGrams, formatPortion, gramsToAmount, portionUnit, readableAmount } from '@/meals/portion';
import { color, foodCategoryTone } from '@/theme/tokens';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';
import { formatPrescription } from '@/workouts/prescription';

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

/** The label of the step that follows `step`, or 完成 after the last one. */
function stepAfter(day: Today, step: string) {
  const next = day.flow.steps[day.flow.steps.indexOf(step) + 1];
  return STEP_LABEL[next ?? 'done'];
}

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
        logged={day.flow.completed.includes('body')}
        after={stepAfter(day, 'body')}
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
        after={stepAfter(day, 'workout')}
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
      onPlanChanged={() => refreshAt(step)}
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
  // Done is not a step on the track, so after looking back the summary needs its own way in.
  const canReturnToSummary = day.flow.current === 'done' && step !== 'done';
  return (
    <View className="gap-3 pb-3">
      <Text className="text-center font-display text-lg font-bold text-ink">
        {parsed.getMonth() + 1} 月 {parsed.getDate()} 日 {WEEKDAY[parsed.getDay()]}
        {day.streak > 0 ? (
          <Text className="text-sm font-normal text-muted">{`  ·  連續 ${day.streak} 天`}</Text>
        ) : null}
      </Text>
      <DaySummary eaten={day.flow.eaten} targets={day.targets} />
      <StepIndicator
        steps={day.flow.steps}
        completed={day.flow.completed}
        current={step}
        next={day.flow.current}
        onSelect={onSelect}
      />
      {canReturnToSummary ? (
        <TextAction label="回到今天總結" onPress={() => onSelect('done')} className="justify-center" />
      ) : null}
    </View>
  );
}

function WeighInStep({
  header,
  date,
  logged,
  after,
  value,
  onChange,
  onSaved,
}: {
  header: ReactNode;
  date: string;
  /** Today's weigh-in is already saved, so the form starts from it instead of empty. */
  logged: boolean;
  after: string;
  value: { weight: string; waist: string };
  onChange: (value: { weight: string; waist: string }) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { weight, waist } = value;
  const prefilled = useRef(false);

  useEffect(() => {
    if (!logged || prefilled.current || weight || waist) return;
    prefilled.current = true;
    let live = true;
    api
      .get<'/body-logs'>(`/body-logs?from_=${date}&to=${date}`)
      .then((logs) => {
        const log = logs.find((entry) => entry.date === date);
        if (!live || !log) return;
        onChange({
          weight: log.weight_kg === null ? '' : String(log.weight_kg),
          waist: log.waist_cm === null ? '' : String(log.waist_cm),
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [logged, date, weight, waist, onChange]);

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
          {busy ? '儲存中…' : logged ? '更新' : `儲存，下一步：${after}`}
        </PrimaryButton>
      }
    >
      {header}
      <View className="gap-4">
      <View className="gap-1">
        <Hint>{logged ? '今天已記錄，改完按更新' : '起床、上完廁所、還沒吃喝前'}</Hint>
        <Title>早安，先量一下</Title>
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
            label="腰圍（選填）"
            suffix="cm"
            value={waist}
            onChangeText={(next) => onChange({ ...value, waist: next })}
            keyboardType="decimal-pad"
          />
        </View>
        <Hint>腰圍量肚臍那一圈，自然吐氣時讀數字。一週量一次就好。</Hint>
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
  onPlanChanged,
}: {
  header: ReactNode;
  step: string;
  day: Today;
  onDone: () => void;
  onStateChanged: () => void;
  onPlanChanged: () => void | Promise<void>;
}) {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [portionItem, setPortionItem] = useState<PlannedMealItem | null>(null);
  const [portion, setPortion] = useState('');
  const [actionItem, setActionItem] = useState<PlannedMealItem | null>(null);

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
  const after = stepAfter(day, step);
  const resolved = day.flow.completed.includes(step);
  const addFood = () =>
    router.navigate(`/meals/add-food?destination=day&date=${day.date}&slot=${step}`);

  const act = async (run: () => Promise<unknown>, refreshSummary = false) => {
    setBusy(true);
    try {
      await run();
      await Promise.all([load(), refreshSummary ? onPlanChanged() : Promise.resolve()]);
      return true;
    } catch (error) {
      Alert.alert('沒有成功', error instanceof ApiError ? error.message : '請稍後再試');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const editPortion = (item: PlannedMealItem) => {
    setPortionItem(item);
    setPortion(formatEditablePortion(item));
  };

  const savePortion = async () => {
    if (!portionItem || !portionItem.food || portionItem.grams === null) return;
    const amount = Number(portion);
    if (amount === Number(formatEditablePortion(portionItem))) {
      setPortionItem(null);
      return;
    }
    const grams = portionToGrams(portionItem, amount);
    if (!Number.isFinite(grams) || grams <= 0) return;
    const saved = await act(
      () => api.patch(`/days/${day.date}/plan/${step}/items/${portionItem.id}`, { grams }),
      true,
    );
    if (saved) setPortionItem(null);
  };

  const removeItem = (item: PlannedMealItem) => {
    const itemName = item.food?.name ?? item.custom_name ?? '這項食物';
    Alert.alert('移除食物', `確定從今天的${STEP_LABEL[step]}移除「${itemName}」？今日統計也會一起更新。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: () => {
          void act(
            () => api.delete(`/days/${day.date}/plan/${step}/items/${item.id}`),
            true,
          );
        },
      },
    ]);
  };

  const replaceItem = (item: PlannedMealItem) => {
    const food = item.food;
    if (!food || item.grams === null) return;
    setActionItem(null);
    requestAnimationFrame(() =>
      router.navigate(
        `/meals/swap-today?date=${day.date}&slot=${step}&item=${item.id}&food=${food.id}&grams=${item.grams}`,
      ),
    );
  };

  const requestRemoveItem = (item: PlannedMealItem) => {
    setActionItem(null);
    requestAnimationFrame(() => removeItem(item));
  };

  // A shuffle also throws away foods the user added by hand, so it asks first.
  const shuffle = () =>
    Alert.alert(
      '整道換掉',
      `會用另一組餐點取代今天的${STEP_LABEL[step]}，你手動加入或調整過的食物也會一起換掉。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '換掉',
          onPress: () => {
            void act(() => api.post(`/days/${day.date}/plan/shuffle`, { meal_time: step }), true);
          },
        },
      ],
    );

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
    // No food is planned for this slot, so there is nothing to mark as eaten: add some, or skip.
    return (
      <Screen
        footerSafeArea={false}
        footer={
          <>
            <PrimaryButton icon={PlusIcon} onPress={addFood} disabled={busy}>
              加入食物
            </PrimaryButton>
            {resolved ? (
              <TextAction
                label="改回未吃"
                disabled={busy}
                onPress={() => setMealState('planned')}
                className="justify-center"
              />
            ) : (
              <TextAction
                label="今天略過這餐"
                disabled={busy}
                onPress={() => setMealState('skipped')}
                className="justify-center"
              />
            )}
          </>
        }
      >
        {header}
        <View className="gap-4">
          <Title sub={resolved ? undefined : '還沒有適合這個時段的餐點'}>{STEP_LABEL[step]}</Title>
          {resolved ? (
            <Card className="gap-2 bg-fill">
              <Text className="text-base font-semibold text-ink">這餐已略過</Text>
              <Hint>不會計入今天的熱量和流程。</Hint>
            </Card>
          ) : (
            <Empty
              compact
              action={<TextAction label="到餐點分頁新增" onPress={() => router.navigate('/meals')} />}
            >
              先加入今天吃的食物。想讓每天自動排進來，就到餐點分頁新增。
            </Empty>
          )}
        </View>
      </Screen>
    );
  }

  // Pinned under the main button so the total stays in view while the list scrolls.
  const total = (
    <View className="flex-row items-baseline justify-between px-1">
      <Text className="text-sm text-muted">整份熱量</Text>
      <Text className="text-lg font-bold text-ink">{Math.round(meal.nutrients.kcal)} 大卡</Text>
    </View>
  );

  const footer = (
    <>
      {meal.skipped ? (
        <>
          <PrimaryButton onPress={() => setMealState('eaten')} busy={busy}>
            {busy ? '處理中…' : '仍要標記吃完'}
          </PrimaryButton>
          <TextAction
            label="改回未吃"
            disabled={busy}
            onPress={() => setMealState('planned')}
            className="justify-center"
          />
        </>
      ) : meal.eaten ? (
        <>
          <Hint>這餐已標記吃完。</Hint>
          {total}
          <TextAction
            label="改回未吃"
            disabled={busy}
            onPress={() => setMealState('planned')}
            className="justify-center"
          />
        </>
      ) : (
        <>
          <PrimaryButton onPress={() => setMealState('eaten')} busy={busy}>
            {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完，下一步：${after}`}
          </PrimaryButton>
          {total}
          <TextAction
            label="今天略過這餐"
            disabled={busy}
            onPress={() => setMealState('skipped')}
            className="justify-center"
          />
        </>
      )}
    </>
  );

  return (
    <Screen footerSafeArea={false} footer={footer}>
      {header}
      <View className="gap-4">
      <View className="gap-1">
        {meal.name ? (
          <>
            <Hint>今天的{STEP_LABEL[step]}</Hint>
            <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
              {meal.name}
            </Text>
          </>
        ) : (
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            今天的{STEP_LABEL[step]}
          </Text>
        )}
        <Hint>點食物列可以替換或移除，點份量可以調整。</Hint>
      </View>

      {meal.skipped ? (
        <Card className="gap-2 bg-fill">
          <Text className="text-base font-semibold text-ink">這餐已略過</Text>
          <Hint>不會計入今天的熱量和流程。</Hint>
        </Card>
      ) : (
        <>
          <Card className="gap-3 p-2">
            {groupPlanItems(meal.items).map((group) => (
              <View
                key={group.category}
                className="overflow-hidden rounded-card"
                style={{ backgroundColor: foodCategoryTone(group.category).soft }}
              >
                <View className="min-h-[52px] flex-row items-center gap-3 px-3 py-2">
                  <FoodCategoryIcon category={group.category} size="sm" solid />
                  <Text className="flex-1 text-lg font-semibold text-ink">{group.label}</Text>
                  <Text className="text-base text-muted">{group.items.length} 項</Text>
                </View>

                <View className="bg-surface">
                  {group.items.map((item, itemIndex) => {
                    const food = item.food;
                    const itemName = food?.name ?? item.custom_name ?? '未命名食物';
                    const canEditGrams = food !== null && item.grams !== null;
                    return (
                      <View key={item.id}>
                        {itemIndex > 0 ? <View className="mx-3 h-px bg-line" /> : null}
                        <View className="min-h-[60px] flex-row items-center gap-2 px-3 py-2">
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`開啟${itemName}操作`}
                            accessibilityState={{ disabled: busy }}
                            disabled={busy}
                            onPress={() => setActionItem(item)}
                            className="min-h-[44px] flex-1 justify-center active:opacity-60"
                          >
                            <Text className="text-base font-semibold text-ink">{itemName}</Text>
                          </Pressable>
                          {canEditGrams ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`調整${itemName}份量，目前${formatPlanAmount(item)}`}
                              disabled={busy}
                              onPress={() => editPortion(item)}
                              className="min-h-[44px] flex-row items-center justify-center gap-1 rounded-full bg-fill px-3 active:opacity-70"
                            >
                              <Text className="text-base font-semibold text-ink">{formatPlanAmount(item)}</Text>
                              <ChevronIcon direction="down" size={14} tint={color.muted} />
                            </Pressable>
                          ) : null}
                          <View aria-hidden className="h-11 w-6 items-center justify-center">
                            <ChevronIcon direction="right" size={18} tint={color.muted} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </Card>

          <View className="flex-row items-center justify-center gap-8">
            <TextAction
              icon={PlusIcon}
              label="加入食物"
              disabled={busy}
              onPress={addFood}
              className="min-h-[44px] justify-center"
            />
            <TextAction
              label="整道換掉"
              disabled={busy}
              onPress={shuffle}
              className="min-h-[44px] justify-center"
            />
          </View>
        </>
      )}

      </View>

      <PortionEditor
        item={portionItem}
        value={portion}
        busy={busy}
        onChange={setPortion}
        onCancel={() => setPortionItem(null)}
        onSave={savePortion}
      />

      <Sheet
        visible={actionItem !== null}
        title={actionItem?.food?.name ?? actionItem?.custom_name ?? '食物操作'}
        onClose={() => setActionItem(null)}
      >
        {actionItem?.food && actionItem.grams !== null ? (
          <PrimaryButton tone="plain" onPress={() => replaceItem(actionItem)} disabled={busy}>
            替換食物
          </PrimaryButton>
        ) : null}
        {actionItem ? (
          <PrimaryButton
            tone="danger"
            icon={TrashIcon}
            onPress={() => requestRemoveItem(actionItem)}
            disabled={busy}
          >
            移除這項食物
          </PrimaryButton>
        ) : null}
      </Sheet>
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
  const order = ['staple', 'protein', 'vegetable', 'fruit', 'fat_sauce', 'other'];
  return [...groups]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([category, groupedItems]) => ({
      category,
      label: labels[category] ?? '其他',
      items: groupedItems,
    }));
}

function formatEditablePortion(item: PlannedMealItem) {
  if (item.grams === null) return '';
  return readableAmount(gramsToAmount(item.food, item.grams));
}

function formatPlanAmount(item: PlannedMealItem) {
  if (item.grams === null) return '';
  return formatPortion(item.food, item.grams);
}

function portionToGrams(item: PlannedMealItem, value: number) {
  return amountToGrams(item.food, value);
}

function PortionEditor({
  item,
  value,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  item: PlannedMealItem | null;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!item) return;
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true),
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [item]);

  const amount = Number(value);
  const valid = Number.isFinite(amount) && amount > 0;
  const itemName = item?.food?.name ?? item?.custom_name ?? '';
  const unit = portionUnit(item?.food);
  const close = () => {
    if (busy) return;
    Keyboard.dismiss();
    setKeyboardVisible(false);
    onCancel();
  };

  return (
    <AppModal visible={item !== null} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          accessible={false}
          onPress={close}
          className="flex-1 justify-end bg-scrim"
        >
          <SafeAreaView
            edges={keyboardVisible ? [] : ['bottom']}
            className="rounded-t-sheet bg-bg px-5 pb-3 pt-5"
          >
            <Pressable accessible={false} onPress={(event) => event.stopPropagation()} className="gap-4">
              {keyboardVisible ? (
                <Text accessibilityRole="header" className="text-base font-semibold text-ink">
                  調整 {itemName} 的份量
                </Text>
              ) : (
                <View className="gap-1">
                  <Text accessibilityRole="header" className="font-display text-2xl font-bold text-ink">
                    調整份量
                  </Text>
                  <Text className="text-base text-muted">{itemName}</Text>
                </View>
              )}
              <Field
                label="份量"
                value={value}
                onChangeText={onChange}
                suffix={unit.label}
                keyboardType="decimal-pad"
                selectTextOnFocus
                onSubmitEditing={Keyboard.dismiss}
              />
              {unit.gramsPerUnit === 1 || !valid ? null : (
                <Hint>約 {readableAmount(amount * unit.gramsPerUnit)} g</Hint>
              )}
              {keyboardVisible ? (
                <PrimaryButton tone="plain" onPress={Keyboard.dismiss} disabled={busy}>
                  完成輸入
                </PrimaryButton>
              ) : (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <PrimaryButton tone="plain" onPress={close} disabled={busy}>
                      取消
                    </PrimaryButton>
                  </View>
                  <View className="flex-1">
                    <PrimaryButton onPress={onSave} disabled={!valid} busy={busy}>
                      {busy ? '儲存中…' : '儲存份量'}
                    </PrimaryButton>
                  </View>
                </View>
              )}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

function WorkoutStep({
  header,
  date,
  after,
  onDone,
  onStateChanged,
}: {
  header: ReactNode;
  date: string;
  after: string;
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
  const [actionItem, setActionItem] = useState<WorkoutItem | null>(null);

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
    Alert.alert('移除動作', `確定移除「${item.item.exercise_name}」？這只會影響今天的訓練。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/days/${date}/workout/items/${item.item.id}`);
            await load();
          } catch (error) {
            Alert.alert('移除不了動作', error instanceof ApiError ? error.message : '請稍後再試');
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

  // The sheet opens from an exercise's title; each choice closes it before acting.
  const replaceExercise = (item: WorkoutItem) => {
    setActionItem(null);
    router.navigate(
      `/workouts/replace-today?date=${date}&item_id=${item.item.id}&exercise_id=${item.item.exercise_id}&name=${encodeURIComponent(item.item.exercise_name)}`,
    );
  };

  const editExercise = (item: WorkoutItem) => {
    setActionItem(null);
    startEdit(item);
  };

  const removeExercise = (item: WorkoutItem) => {
    setActionItem(null);
    deleteItem(item);
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

  // Pinned under the main button, like the meal total, so progress stays in view.
  const progress = (
    <View className="flex-row items-baseline justify-between px-1">
      <Text className="text-sm text-muted">完成進度</Text>
      <Text className="text-lg font-bold text-ink">
        {completedExercises} / {workout.items.length} 個動作
      </Text>
    </View>
  );

  return (
    <Screen
      footerSafeArea={false}
      footer={
        workoutSkipped ? (
          <PrimaryButton onPress={complete} busy={busy}>
            仍要完成今日訓練
          </PrimaryButton>
        ) : allComplete && workout.items.length > 0 ? (
          <>
            <PrimaryButton onPress={complete} busy={busy}>
              {busy ? '處理中…' : `完成今日訓練，下一步：${after}`}
            </PrimaryButton>
            {progress}
          </>
        ) : (
          <>
            {progress}
            <TextAction
              label="今天略過訓練"
              disabled={busy}
              onPress={skipWorkout}
              className="justify-center"
            />
          </>
        )
      }
    >
      {header}
      <View className="gap-4">
        <View className="gap-1">
          <Hint>今天的訓練</Hint>
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            {templateName ?? '今天沒有排定訓練'}
          </Text>
          {workout.items.length > 0 && !workoutSkipped ? (
            <Hint>點動作名稱可以換動作、編輯或移除。</Hint>
          ) : null}
        </View>

        {workoutSkipped ? (
          <Card className="gap-3 bg-fill">
            <View className="gap-1">
              <Text className="text-base font-semibold text-ink">今天已略過訓練</Text>
              <Hint>略過已儲存。若後來完成了訓練，可直接標記完成。</Hint>
            </View>
          </Card>
        ) : (
          <>
            {workout.items.length > 0 ? (
              <Card className="gap-3 p-2">
                {workout.items.map((item, itemIndex) => {
                  const prescribed = item.item;
                  const setCount = prescribed.sets ?? 1;
                  const completed = completedSetCount(item);
                  const ungrouped = prescribed.sets === null;
                  const suggestion = suggestions[prescribed.id];

                  return (
                    <View key={prescribed.id} className="overflow-hidden rounded-card bg-fill">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`開啟${prescribed.exercise_name}操作`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() => setActionItem(item)}
                        className="min-h-[52px] flex-row items-center gap-3 px-3 py-2 active:opacity-70"
                      >
                        <Text className="flex-1 text-base font-semibold text-ink">
                          {itemIndex + 1}. {prescribed.exercise_name}
                        </Text>
                        <Text className="text-sm text-muted">{formatPrescription(prescribed)}</Text>
                        <ChevronIcon direction="right" size={16} tint={color.muted} />
                      </Pressable>

                      <View className="gap-3 bg-surface px-3 py-3">
                        {prescribed.replaced_exercise_name ? (
                          <Hint>今天已替換原本的 {prescribed.replaced_exercise_name}</Hint>
                        ) : null}
                        {prescribed.note ? <Hint>{prescribed.note}</Hint> : null}

                        {editingItem === prescribed.id && edit ? (
                          <View className="gap-3 rounded-field bg-fill p-3">
                            {prescribed.duration_sec ? (
                              <Field
                                label="時間"
                                suffix="分鐘"
                                value={edit.durationMin}
                                onChangeText={(durationMin) =>
                                  setEdit((current) => current && { ...current, durationMin })
                                }
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
                                <PrimaryButton
                                  tone="plain"
                                  onPress={() => {
                                    setEditingItem(null);
                                    setEdit(null);
                                  }}
                                  disabled={busy}
                                >
                                  取消
                                </PrimaryButton>
                              </View>
                              <View className="flex-1">
                                <PrimaryButton
                                  onPress={() => saveEdit(item)}
                                  disabled={busy || (!prescribed.duration_sec && !edit.reps)}
                                >
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
                                  className={`min-h-[44px] min-w-[72px] flex-row items-center justify-center gap-1 rounded-field px-3 ${
                                    done ? 'bg-good-soft' : 'bg-fill'
                                  } ${busy || !available ? 'opacity-40' : ''}`}
                                >
                                  <Text className={`text-base ${done ? 'text-good' : 'text-ink'}`}>
                                    第 {setIndex + 1} 組
                                  </Text>
                                  {done ? <CheckIcon size={16} tint={color.good} /> : null}
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
                            {workout.template?.is_builtin ? (
                              <Hint>公用課表維持唯讀；複製成自己的課表後可保存建議重量。</Hint>
                            ) : (
                              <Pressable
                                accessibilityRole="button"
                                disabled={busy}
                                onPress={() => applySuggestion(item)}
                                className="min-h-[44px] justify-center"
                              >
                                <Text className="text-base font-semibold text-primary">套用到課表</Text>
                              </Pressable>
                            )}
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : (
              <Hint>今天沒有安排訓練。</Hint>
            )}

            {workout.estimated_burn_kcal ? (
              <Hint>
                今天訓練約消耗 {workout.estimated_burn_kcal} 大卡。這是依動作強度和課表時間的粗估，
                沒有算進你的熱量目標——目標裡的活動量已經含了訓練。
              </Hint>
            ) : null}

            <View className="flex-row items-center justify-center gap-8">
              <TextAction
                icon={PlusIcon}
                label="加入動作"
                disabled={busy}
                onPress={() => router.navigate(`/workouts/add-today?date=${date}`)}
                className="min-h-[44px] justify-center"
              />
              {workout.items.length > 0 ? (
                <TextAction
                  label="另存為我的課表"
                  disabled={busy}
                  onPress={() => router.navigate({ pathname: '/workouts/save-today', params: { date } })}
                  className="min-h-[44px] justify-center"
                />
              ) : null}
            </View>
          </>
        )}
      </View>

      <Sheet
        visible={actionItem !== null}
        title={actionItem?.item.exercise_name ?? '動作'}
        onClose={() => setActionItem(null)}
      >
        {actionItem ? (
          <>
            <ExerciseFigure
              exerciseId={actionItem.item.exercise_id}
              name={actionItem.item.exercise_name}
              mode="pair"
            />
            <PrimaryButton tone="plain" onPress={() => replaceExercise(actionItem)} disabled={busy}>
              換動作
            </PrimaryButton>
            <PrimaryButton tone="plain" onPress={() => editExercise(actionItem)} disabled={busy}>
              編輯
            </PrimaryButton>
            <PrimaryButton
              tone="danger"
              icon={TrashIcon}
              onPress={() => removeExercise(actionItem)}
              disabled={busy}
            >
              移除這個動作
            </PrimaryButton>
          </>
        ) : null}
      </Sheet>
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

      <Hint>想改哪一步，點上面的進度列回去。</Hint>
    </View>
  );
}
