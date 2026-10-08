import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { AppModal } from '@/components/AppModal';
import { DaySummary } from '@/components/DaySummary';
import { BowlIcon, CameraIcon, CheckIcon, ChevronIcon, CloseIcon, PlusIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { STEP_LABEL, StepIndicator } from '@/components/StepIndicator';
import { AddRow, Card, Empty, Field, Hint, PrimaryButton, Screen, SectionHeading, TextAction, Title } from '@/components/ui';
import { dayWord, shiftDay, todayISO } from '@/dates';
import { FoodGroup, FoodItem } from '@/meals/FoodGroup';
import { photoDraft } from '@/meals/photo-draft';
import { clearSession, loadSession } from '@/workouts/focus/storage';
import { photoErrorMessage, pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';
import { amountToGrams, formatPortion, gramsToAmount, portionUnit, readableAmount } from '@/meals/portion';
import { color } from '@/theme/tokens';
import { rowsFromLogs, toRecords, type RecordRow } from '@/workouts/record';
import { dayFooter } from '@/workouts/day-footer';
import { targetChanges, targetError, targetFromItem, type TargetEdit } from '@/workouts/target';
import { isItemDone, WorkoutItemRow } from '@/workouts/WorkoutItemRow';

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
type SetLogResult = { next_weight_kg: number | null };

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

/** Where finishing `step` leads: the first other step still to do, or 完成. */
function stepAfter(day: Today, step: string) {
  const next = day.flow.waiting.find((waiting) => waiting !== step);
  return STEP_LABEL[next ?? 'done'];
}

/** How far back the day switcher goes. */
const MAX_DAYS_BACK = 30;

export default function TodayScreen() {
  const [day, setDay] = useState<Today | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [weighIn, setWeighIn] = useState({ weight: '', waist: '' });
  // The day being edited. null follows the clock, so the screen is on today after midnight too.
  const [picked, setPicked] = useState<string | null>(null);
  const today = todayISO();
  const date = picked ?? today;
  // A reply for a day the user has already left is dropped.
  const loadVersion = useRef(0);
  // What the screen showed last, read when a fresh copy of the day arrives.
  const shown = useRef<{ day: Today | null; viewing: string | null }>({ day: null, viewing: null });
  useEffect(() => {
    shown.current = { day, viewing };
  }, [day, viewing]);

  /**
   * Show a fresh copy of the day, staying on `step`, unless that step has just been finished
   * — eaten, skipped, weighed, trained, from this screen or from focus mode. Then it moves on
   * to what is left, however it was finished. Changing a step already done (a portion, 改回未吃)
   * stays put.
   */
  const settle = useCallback((fresh: Today, step: string | null) => {
    const before = shown.current.day;
    const justFinished =
      step !== null &&
      before?.date === fresh.date &&
      before.flow.waiting.includes(step) &&
      !fresh.flow.waiting.includes(step);
    setDay(fresh);
    setViewing(justFinished ? null : step);
  }, []);

  const load = useCallback(async (resetStep = false) => {
    const version = ++loadVersion.current;
    try {
      const fresh = await api.get(`/days/${date}`);
      if (version !== loadVersion.current) return;
      settle(fresh, resetStep ? null : shown.current.viewing);
    } catch (error) {
      if (version !== loadVersion.current) return;
      Alert.alert(`讀不到${dayWord(date)}的資料`, error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [date, settle]);

  const refreshAt = useCallback(
    async (step: string) => {
      const version = ++loadVersion.current;
      try {
        const fresh = await api.get(`/days/${date}`);
        if (version !== loadVersion.current) return;
        settle(fresh, step);
      } catch (error) {
        if (version !== loadVersion.current) return;
        Alert.alert(`讀不到${dayWord(date)}的資料`, error instanceof ApiError ? error.message : '請稍後再試');
      }
    },
    [date, settle],
  );

  const goTo = (next: string) => {
    if (next === date || next > today || next < shiftDay(today, -MAX_DAYS_BACK)) return;
    setDay(null);
    setViewing(null);
    setWeighIn({ weight: '', waist: '' });
    setPicked(next === today ? null : next);
  };

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
  const header = (
    <TodayHeader
      day={day}
      step={step}
      onSelect={setViewing}
      canGoBack={day.date > shiftDay(today, -MAX_DAYS_BACK)}
      canGoForward={day.date < today}
      onShift={(days) => goTo(shiftDay(day.date, days))}
      onToday={() => goTo(today)}
    />
  );

  if (step === 'body') {
    return (
      <WeighInStep
        key={day.date}
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
      <Screen key={day.date} footerSafeArea={false}>
        {header}
        <DoneStep day={day} onChanged={() => load()} />
      </Screen>
    );
  }
  if (step === 'workout') {
    return (
      <WorkoutStep
        key={day.date}
        header={header}
        date={day.date}
        after={stepAfter(day, 'workout')}
        resolved={day.flow.completed.includes('workout')}
        skipped={day.flow.skipped.includes('workout')}
        burnAdded={day.targets.exercise_kcal > 0}
        onDone={() => load(true)}
        onStateChanged={() => refreshAt('workout')}
      />
    );
  }
  return (
    <MealStep
      key={day.date}
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
  canGoBack,
  canGoForward,
  onShift,
  onToday,
}: {
  day: Today;
  step: string;
  onSelect: (step: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Move the screen to another day: -1 is the day before. */
  onShift: (days: -1 | 1) => void;
  onToday: () => void;
}) {
  const parsed = new Date(`${day.date}T00:00:00`);
  const isToday = day.date === todayISO();
  // Done is not a step on the track, so after looking back the summary needs its own way in.
  const canReturnToSummary = day.flow.current === 'done' && step !== 'done';
  return (
    <View className="gap-3 pb-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="前一天"
          disabled={!canGoBack}
          onPress={() => onShift(-1)}
          className={`h-11 w-11 items-center justify-center ${canGoBack ? '' : 'opacity-30'}`}
        >
          <ChevronIcon direction="left" size={22} tint={color.ink} />
        </Pressable>
        <Text className="text-center font-display text-lg font-bold text-ink">
          {parsed.getMonth() + 1} 月 {parsed.getDate()} 日 {WEEKDAY[parsed.getDay()]}
          {day.streak > 0 ? (
            <Text className="text-sm font-normal text-muted">{`  ·  連續 ${day.streak} 天`}</Text>
          ) : null}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="後一天"
          disabled={!canGoForward}
          onPress={() => onShift(1)}
          className={`h-11 w-11 items-center justify-center ${canGoForward ? '' : 'opacity-30'}`}
        >
          <ChevronIcon direction="right" size={22} tint={color.ink} />
        </Pressable>
      </View>
      {isToday ? null : (
        <TextAction label="回到今天" onPress={onToday} className="min-h-[44px] justify-center self-center" />
      )}
      <DaySummary
        eaten={day.flow.eaten}
        targets={day.targets}
        onAddSnack={() =>
          router.navigate({ pathname: '/meals/add-food', params: { destination: 'day', date: day.date, slot: 'extras' } })
        }
      />
      <StepIndicator
        steps={day.flow.steps}
        completed={day.flow.completed}
        skipped={day.flow.skipped}
        current={step}
        next={day.flow.current}
        onSelect={onSelect}
      />
      {canReturnToSummary ? (
        <TextAction label={`回到${dayWord(day.date)}總結`} onPress={() => onSelect('done')} className="justify-center" />
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
  const word = dayWord(date);
  const isToday = word === '今天';

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
        <Hint>
          {logged
            ? `${word}已記錄，改完按更新`
            : isToday
              ? '起床、上完廁所、還沒吃喝前'
              : `補記${word}的體重和腰圍`}
        </Hint>
        <Title>{isToday ? '早安，先量一下' : '補記體重'}</Title>
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [portionItem, setPortionItem] = useState<PlannedMealItem | null>(null);
  const [portion, setPortion] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan((await api.get(`/days/${day.date}/plan`)) as unknown as DayPlan);
    } catch (error) {
      Alert.alert(`讀不到${dayWord(day.date)}的餐點`, error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [day.date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const meal = plan?.meals.find((m) => m.meal_time === step);
  const word = dayWord(day.date);
  const resolved = day.flow.completed.includes(step);
  // The add sheet closes before navigating, so it is not still open on the way back.
  const addFrom = (source: 'meal' | 'food') => {
    setAdding(false);
    requestAnimationFrame(() =>
      router.navigate(
        source === 'meal'
          ? `/meals/pick-today?date=${day.date}&slot=${step}`
          : `/meals/add-food?destination=day&date=${day.date}&slot=${step}`,
      ),
    );
  };
  const recordFromPhoto = async () => {
    setPhotoBusy(true);
    try {
      const analysis = await pickAndAnalyzeMealPhoto();
      if (!analysis) return;
      photoDraft.set(analysis);
      router.navigate({
        pathname: '/meals/photo-results',
        // finish: the results screen records the food and marks this meal eaten in one step.
        params: { destination: 'day', date: day.date, slot: step, analysis_id: analysis.id, finish: '1' },
      });
    } catch (error) {
      Alert.alert('無法辨識餐點', photoErrorMessage(error));
    } finally {
      setPhotoBusy(false);
    }
  };

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
    Alert.alert('移除食物', `確定從${word}的${STEP_LABEL[step]}移除「${itemName}」？當天的統計也會一起更新。`, [
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
    router.navigate(
      `/meals/swap-today?date=${day.date}&slot=${step}&item=${item.id}&food=${food.id}&grams=${item.grams}`,
    );
  };

  const setMealState = async (state: 'eaten' | 'skipped' | 'planned') => {
    const saved = await act(() => api.patch(`/days/${day.date}/meals/${step}`, { state }));
    if (saved) {
      if (state === 'eaten') onDone();
      else onStateChanged();
    }
  };

  const addSheet = (
    <Sheet visible={adding} title={`加入${STEP_LABEL[step]}`} onClose={() => setAdding(false)}>
      <PrimaryButton tone="plain" icon={BowlIcon} onPress={() => addFrom('meal')}>
        從我的餐點選一道
      </PrimaryButton>
      <PrimaryButton tone="plain" icon={PlusIcon} onPress={() => addFrom('food')}>
        從食物庫加入
      </PrimaryButton>
    </Sheet>
  );

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

  if (!meal || meal.items.length === 0) {
    // Nothing logged for this slot yet: photograph what was eaten (the quickest way in), add a
    // saved meal or foods by hand, or skip.
    return (
      <Screen
        footerSafeArea={false}
        footer={
          <>
            <PrimaryButton icon={CameraIcon} onPress={recordFromPhoto} disabled={busy} busy={photoBusy}>
              {photoBusy ? '辨識中…' : '拍照記錄這餐'}
            </PrimaryButton>
            <View className="flex-row items-center justify-center gap-8">
              <TextAction
                label="加入"
                icon={PlusIcon}
                disabled={busy || photoBusy}
                onPress={() => setAdding(true)}
                className="min-h-[44px] justify-center"
              />
              {resolved ? (
                <TextAction
                  label="改回未吃"
                  disabled={busy}
                  onPress={() => setMealState('planned')}
                  className="min-h-[44px] justify-center"
                />
              ) : (
                <TextAction
                  label="略過這餐"
                  disabled={busy || photoBusy}
                  onPress={() => setMealState('skipped')}
                  className="min-h-[44px] justify-center"
                />
              )}
            </View>
          </>
        }
      >
        {header}
        <View className="gap-4">
          <Title>{STEP_LABEL[step]}</Title>
          {resolved ? (
            <Card className="gap-2 bg-fill">
              <Text className="text-base font-semibold text-ink">這餐已略過</Text>
              <Hint>不會計入{word}的熱量和流程。</Hint>
            </Card>
          ) : (
            <Empty compact>拍下{word}的{STEP_LABEL[step]}，確認份量後就記錄完成；也可以從我的餐點或食物庫加入。</Empty>
          )}
        </View>
        {addSheet}
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
        // Foods added by hand: once they are all in, finishing the meal is the main step.
        <>
          <PrimaryButton icon={CheckIcon} onPress={() => setMealState('eaten')} busy={busy}>
            {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完，下一步：${stepAfter(day, step)}`}
          </PrimaryButton>
          {total}
          <TextAction
            label="略過這餐"
            disabled={busy}
            onPress={() => setMealState('skipped')}
            className="min-h-[44px] justify-center"
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
            <Hint>{word}的{STEP_LABEL[step]}</Hint>
            <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
              {meal.name}
            </Text>
          </>
        ) : (
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            {word}的{STEP_LABEL[step]}
          </Text>
        )}
      </View>

      {meal.skipped ? (
        <Card className="gap-2 bg-fill">
          <Text className="text-base font-semibold text-ink">這餐已略過</Text>
          <Hint>不會計入{word}的熱量和流程。</Hint>
        </Card>
      ) : (
        <>
          {/* The list, a dashed row to add to it, then saving the meal as a whole, like the
              workout list, so the footer only finishes the meal. */}
          <View className="gap-2.5">
            <Card className="gap-3 p-2">
              {groupPlanItems(meal.items).map((group) => (
                <FoodGroup key={group.category} category={group.category} label={group.label}>
                  {group.items.map((item) => {
                    // Only a food from the library has a portion to edit or a swap to offer.
                    const canEditGrams = item.food !== null && item.grams !== null;
                    return (
                      <FoodItem
                        key={item.id}
                        name={item.food?.name ?? item.custom_name ?? '未命名食物'}
                        amount={formatPlanAmount(item)}
                        busy={busy}
                        onReplace={canEditGrams ? () => replaceItem(item) : undefined}
                        onAmount={canEditGrams ? () => editPortion(item) : undefined}
                        onRemove={() => removeItem(item)}
                      />
                    );
                  })}
                </FoodGroup>
              ))}
            </Card>
            <AddRow label="加入食物" disabled={busy} onPress={() => setAdding(true)} />
          </View>
          {meal.items.some((item) => item.food) ? (
            <View className="items-center">
              <TextAction
                label="存成我的餐點"
                disabled={busy}
                onPress={() => router.navigate(`/meals/save-today?date=${day.date}&slot=${step}`)}
                className="min-h-[44px] justify-center"
              />
            </View>
          ) : null}
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

      {addSheet}
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
          {/* Padding sits on the inner Pressable: on web SafeAreaView overwrites className padding. */}
          <SafeAreaView edges={keyboardVisible ? [] : ['bottom']} className="rounded-t-sheet bg-bg">
            <Pressable
              accessible={false}
              onPress={(event) => event.stopPropagation()}
              className="gap-4 px-5 pb-3 pt-5"
            >
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
              {/* Field is flex-1: as a direct child of this column in a sheet its height basis is 0 and it
                  collapses to a line. In a row the flex-1 is horizontal, and the height follows the input. */}
              <View className="flex-row">
                <Field
                  label="份量"
                  value={value}
                  onChangeText={onChange}
                  suffix={unit.label}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
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
  resolved,
  skipped,
  burnAdded,
  onDone,
  onStateChanged,
}: {
  header: ReactNode;
  date: string;
  after: string;
  /** The workout step is already done (or skipped) for this date. */
  resolved: boolean;
  /** Skipped, and not done since. */
  skipped: boolean;
  /** The day's target already counts this workout, which it does only once it is done. */
  burnAdded: boolean;
  onDone: () => void;
  onStateChanged: () => void;
}) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);
  // Several exercises can be open at once, so a whole day can be typed in top to bottom.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  // Typed in and not saved yet, per item: the target fields, and the sets. An item without an
  // entry shows what the server has.
  const [targets, setTargets] = useState<Record<string, TargetEdit>>({});
  const [drafts, setDrafts] = useState<Record<string, RecordRow[]>>({});
  const [suggestions, setSuggestions] = useState<Record<string, number>>({});
  const [sessionStarted, setSessionStarted] = useState(false);
  const word = dayWord(date);

  const load = useCallback(async () => {
    try {
      setWorkout(await api.get(`/days/${date}/workout`));
    } catch (error) {
      Alert.alert(`讀不到${dayWord(date)}的訓練`, error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
      void loadSession(date).then((stored) => setSessionStarted(stored !== null));
    }, [load, date]),
  );

  // One save for everything typed in, so the footer never offers a way out that drops it.
  const dirty = Object.keys(drafts).length > 0 || Object.keys(targets).length > 0;

  const forget = (itemId: string) => {
    setDrafts(({ [itemId]: _rows, ...rest }) => rest);
    setTargets(({ [itemId]: _target, ...rest }) => rest);
  };

  const toggle = (itemId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(itemId)) next.add(itemId);
      return next;
    });

  const discardChanges = () => {
    setDrafts({});
    setTargets({});
  };

  const saveChanges = async () => {
    if (!workout) return;
    const records: { entry: WorkoutItem; sets: Schema<'SetRecordIn'>[] }[] = [];
    const changes: { entry: WorkoutItem; edit: TargetEdit }[] = [];
    for (const entry of workout.items) {
      const rows = drafts[entry.item.id];
      if (rows) {
        const result = toRecords(entry, rows);
        if ('error' in result) {
          Alert.alert('還不能儲存', `「${entry.item.exercise_name}」${result.error}。`);
          return;
        }
        records.push({ entry, sets: result.sets });
      }
      const edit = targets[entry.item.id];
      if (edit) {
        const problem = targetError(entry, edit);
        if (problem) {
          Alert.alert('還不能儲存', `「${entry.item.exercise_name}」${problem}。`);
          return;
        }
        changes.push({ entry, edit });
      }
    }

    setBusy(true);
    try {
      for (const { entry, sets } of records) {
        const result = (await api.put(`/days/${date}/workout/items/${entry.item.id}/sets`, {
          sets,
        })) as SetLogResult;
        const itemId = entry.item.id;
        const nextWeight = result.next_weight_kg;
        // A record whose last set no longer says how it felt has nothing to suggest.
        setSuggestions(({ [itemId]: _old, ...rest }) =>
          nextWeight === null ? rest : { ...rest, [itemId]: nextWeight },
        );
        // Dropped one by one, so a failure further down does not send these twice.
        setDrafts(({ [itemId]: _saved, ...rest }) => rest);
      }
      for (const { entry, edit } of changes) {
        const itemId = entry.item.id;
        await api.patch(`/days/${date}/workout/items/${itemId}`, targetChanges(entry, edit));
        setTargets(({ [itemId]: _saved, ...rest }) => rest);
      }
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      await load();
      // The sets change the day's burn, so the target in the header is read again too.
      onStateChanged();
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await api.patch(`/days/${date}`, { workout_done: true });
      // Finished here rather than at focus mode's summary: a session left on the phone is done with.
      await clearSession(date);
      onDone();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  // Any exercise can go, logged or not; asking every time keeps the ✕ meaning one thing.
  const deleteItem = (entry: WorkoutItem) => {
    const name = entry.item.exercise_name;
    const logged = entry.logs.length;
    const message = !logged
      ? `確定移除「${name}」？這只會影響${word}的訓練。`
      : entry.item.duration_sec
        ? `確定移除「${name}」？已記錄的時間也會一起刪除。`
        : `確定移除「${name}」？已記錄的 ${logged} 組也會一起刪除。`;
    Alert.alert('移除動作', message, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/days/${date}/workout/items/${entry.item.id}`);
            forget(entry.item.id);
            await load();
            // Its sets leave the day's burn, and with it the target.
            onStateChanged();
          } catch (error) {
            Alert.alert('移除不了動作', error instanceof ApiError ? error.message : '請稍後再試');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const skipWorkout = async () => {
    setBusy(true);
    try {
      await api.patch(`/days/${date}`, { workout_skipped: true });
      onStateChanged();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  // What was typed for the old exercise does not carry over to the one replacing it.
  const replaceExercise = (entry: WorkoutItem) => {
    forget(entry.item.id);
    router.navigate(
      `/workouts/replace-today?date=${date}&item_id=${entry.item.id}&exercise_id=${entry.item.exercise_id}&name=${encodeURIComponent(entry.item.exercise_name)}`,
    );
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

  const total = workout.items.length;
  const finished = workout.items.filter(isItemDone).length;
  const footer = dayFooter({
    today: date === todayISO(),
    total,
    finished,
    planned: workout.template !== null || total > 0,
    logged: workout.items.some((entry) => entry.logs.length > 0),
    session: sessionStarted,
    done: resolved && !skipped,
    skipped,
    dirty,
  });
  const templateName = workout.template?.name;

  const footerView = (() => {
    switch (footer.kind) {
      case 'save':
        return (
          <>
            <PrimaryButton onPress={saveChanges} busy={busy}>
              {busy ? '儲存中…' : '儲存修改'}
            </PrimaryButton>
            <View className="items-center">
              <TextAction label="放棄修改" disabled={busy} onPress={discardChanges} className="min-h-[44px] justify-center" />
            </View>
          </>
        );
      case 'train':
        return (
          <>
            <PrimaryButton onPress={() => router.navigate(`/workouts/focus?date=${date}`)} disabled={busy}>
              {footer.resume ? `繼續訓練 · ${finished} / ${total}` : '開始訓練'}
            </PrimaryButton>
            {footer.then ? (
              <View className="items-center">
                <TextAction
                  label={footer.then === 'complete' ? `完成${word}的訓練` : '略過訓練'}
                  disabled={busy}
                  onPress={footer.then === 'complete' ? complete : skipWorkout}
                  className="min-h-[44px] justify-center"
                />
              </View>
            ) : null}
          </>
        );
      case 'complete':
        return (
          <PrimaryButton onPress={complete} busy={busy}>
            {busy ? '處理中…' : `完成${word}的訓練，下一步：${after}`}
          </PrimaryButton>
        );
      case 'skip':
        return (
          <View className="items-center">
            <TextAction label={`${word}略過訓練`} disabled={busy} onPress={skipWorkout} className="min-h-[44px] justify-center" />
          </View>
        );
      case 'done':
        return <Text className="pt-2 text-center text-base font-semibold text-good">✓ {word}的訓練已完成</Text>;
      case 'skipped':
        return <Text className="pt-2 text-center text-base font-semibold text-muted">{word}已略過訓練</Text>;
      case 'none':
        return null;
    }
  })();

  return (
    <Screen footerSafeArea={false} footer={footerView}>
      {header}
      <View className="gap-4">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Hint>{word}的訓練</Hint>
            {skipped ? (
              <Text className="rounded-full bg-warm-soft px-2 py-0.5 text-xs font-semibold text-warm">已略過</Text>
            ) : null}
          </View>
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            {templateName ?? (total ? `${word}的訓練` : `${word}沒有排定訓練`)}
          </Text>
          {total > 0 ? (
            <Hint>
              {total} 個動作
              {workout.template?.duration_min ? ` · 約 ${workout.template.duration_min} 分鐘` : ''}
              {' · 點動作可以改目標或補記組數'}
            </Hint>
          ) : null}
        </View>

        <View className="gap-2.5">
          {workout.items.map((entry, index) => {
            const itemId = entry.item.id;
            return (
              <WorkoutItemRow
                key={itemId}
                entry={entry}
                index={index}
                open={open.has(itemId)}
                onToggle={() => toggle(itemId)}
                target={targets[itemId] ?? targetFromItem(entry)}
                onTargetChange={(target) => setTargets((current) => ({ ...current, [itemId]: target }))}
                rows={drafts[itemId] ?? rowsFromLogs(entry)}
                onRowsChange={(rows) => setDrafts((current) => ({ ...current, [itemId]: rows }))}
                edited={itemId in targets || itemId in drafts}
                suggestion={suggestions[itemId]}
                busy={busy}
                word={word}
                onReplace={() => replaceExercise(entry)}
                onRemove={() => deleteItem(entry)}
              />
            );
          })}
          <AddRow
            label="加入動作"
            disabled={busy}
            onPress={() => router.navigate(`/workouts/add-today?date=${date}`)}
          />
        </View>

        {workout.estimated_burn_kcal ? (
          <Hint>
            {word}訓練約多消耗 {workout.estimated_burn_kcal} 大卡：依動作強度和時間粗估，已扣掉靜止時本來就會消耗的部分，所以會比跑步機面板顯示的少。
            {burnAdded ? `其中一半已加進${word}的熱量目標。` : `標記完成後，其中一半會加進${word}的熱量目標。`}
          </Hint>
        ) : null}

        {total > 0 ? (
          <View className="items-center">
            <TextAction
              label="另存為我的課表"
              disabled={busy}
              onPress={() => router.navigate({ pathname: '/workouts/save-today', params: { date } })}
              className="min-h-[44px] justify-center"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

// Below this share of the target, a finished day reads as too little rather than room to spare:
// in a deficit already, undereating costs muscle and comes back as hunger the next day.
const UNDER_EATING_SHARE = 0.7;

function DoneStep({ day, onChanged }: { day: Today; onChanged: () => void }) {
  const [extras, setExtras] = useState<Schema<'ExtraItemOut'>[] | null>(null);
  const target = day.targets.kcal;
  const eaten = Math.round(day.flow.eaten.kcal);
  const remaining = target - eaten;
  const share = target ? eaten / target : 1;
  const proteinShort = Math.round(day.targets.protein_g - day.flow.eaten.protein_g);

  const loadExtras = useCallback(async () => {
    try {
      setExtras(((await api.get(`/days/${day.date}/plan`)) as Schema<'DayPlanOut'>).extras);
    } catch {
      setExtras([]);
    }
  }, [day.date]);

  useFocusEffect(
    useCallback(() => {
      void loadExtras();
    }, [loadExtras]),
  );

  const removeExtra = (item: Schema<'ExtraItemOut'>) =>
    Alert.alert('移除點心', `確定移除「${item.name}」？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/days/${day.date}/meals/extras/items/${item.id}`);
            await loadExtras();
            onChanged();
          } catch (error) {
            Alert.alert('移除不了', error instanceof ApiError ? error.message : '請稍後再試');
          }
        },
      },
    ]);

  const addSnack = () =>
    router.navigate({ pathname: '/meals/add-food', params: { destination: 'day', date: day.date, slot: 'extras' } });

  return (
    <View className="flex-1 gap-4">
      <Title sub={`${dayWord(day.date)}的流程都走完了`}>辛苦了</Title>

      <Card className="gap-3">
        <Text className="font-display text-4xl font-bold text-ink">
          {eaten.toLocaleString()}{' '}
          <Text className="text-base font-normal text-muted">/ {target.toLocaleString()} 大卡</Text>
        </Text>
        {remaining < 0 ? (
          <Text className="text-base text-warm">超過 {(-remaining).toLocaleString()} 大卡</Text>
        ) : share < UNDER_EATING_SHARE ? (
          <View className="gap-1">
            <Text className="text-base font-semibold text-warm">只吃了目標的 {Math.round(share * 100)}%</Text>
            <Hint>
              吃太少容易流失肌肉，隔天也更容易餓。
              {proteinShort > 0 ? `可以補一份蛋白質，還差 ${proteinShort} g。` : ''}
            </Hint>
          </View>
        ) : (
          <Text className="text-base text-good">還有 {remaining.toLocaleString()} 大卡的空間</Text>
        )}
        {day.streak > 0 ? <Hint>連續 {day.streak} 天完成流程。</Hint> : null}
      </Card>

      <Card className="gap-2">
        <SectionHeading
          action={<TextAction icon={PlusIcon} label="補記點心" onPress={addSnack} className="min-h-[44px] justify-center" />}
        >
          點心
        </SectionHeading>
        {extras === null ? null : extras.length ? (
          extras.map((item) => (
            <View key={item.id} className="min-h-[44px] flex-row items-center gap-2">
              <Text className="flex-1 text-base text-ink" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-sm text-muted">{Math.round(item.nutrients.kcal)} 大卡</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`移除${item.name}`}
                onPress={() => removeExtra(item)}
                className="h-11 w-11 items-center justify-center active:opacity-60"
              >
                <CloseIcon size={18} tint={color.muted} />
              </Pressable>
            </View>
          ))
        ) : (
          <Hint>三餐以外吃的東西記在這裡，記下就算吃了。</Hint>
        )}
      </Card>

      <Hint>想改哪一步，點上面的進度列回去。</Hint>
    </View>
  );
}
