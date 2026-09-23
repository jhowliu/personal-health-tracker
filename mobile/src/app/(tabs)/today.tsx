import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { formatGrams, groupByCategory } from '@/components/MealCard';
import { STEP_LABEL, StepIndicator } from '@/components/StepIndicator';
import { Card, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

type Today = Schema<'TodayOut'>;
type DayPlan = Schema<'DayPlanOut'>;

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const [day, setDay] = useState<Today | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const date = todayISO();

  const load = useCallback(async () => {
    try {
      const fresh = await api.get(`/days/${date}`);
      setDay(fresh);
      setViewing(null);
    } catch (error) {
      Alert.alert('讀不到今天的資料', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!day) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const step = viewing ?? day.flow.current;
  const parsed = new Date(`${day.date}T00:00:00`);

  return (
    <Screen scroll={false}>
      <View className="gap-3 pb-3">
        <View className="items-center">
          <Text className="font-display text-lg font-bold text-ink">
            {parsed.getMonth() + 1} 月 {parsed.getDate()} 日 {WEEKDAY[parsed.getDay()]}
          </Text>
          <Text className="text-sm text-muted">
            已吃 {Math.round(day.flow.eaten_kcal).toLocaleString()} / {day.targets.kcal.toLocaleString()} 大卡
            {day.streak > 0 ? ` · 連續 ${day.streak} 天` : ''}
          </Text>
        </View>

        <StepIndicator
          steps={day.flow.steps}
          completed={day.flow.completed}
          current={day.flow.current}
          onSelect={setViewing}
        />
      </View>

      <View className="flex-1">
        {step === 'body' ? (
          <WeighInStep date={day.date} onSaved={load} />
        ) : step === 'done' ? (
          <DoneStep day={day} />
        ) : step === 'workout' ? (
          <WorkoutStep day={day} onDone={load} />
        ) : (
          <MealStep step={step} day={day} onDone={load} />
        )}
      </View>
    </Screen>
  );
}

function WeighInStep({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [busy, setBusy] = useState(false);

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
    <View className="flex-1 gap-4">
      <View className="gap-1">
        <Hint>起床、上完廁所、還沒吃喝前</Hint>
        <Title>早安,先量一下</Title>
      </View>

      <Card className="gap-3">
        <View className="flex-row gap-3">
          <Field label="體重" suffix="kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Field
            label="腰圍(選填)"
            suffix="cm"
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
          />
        </View>
        <Hint>腰圍量肚臍那一圈,自然吐氣時讀數字。一週量一次就好。</Hint>
      </Card>

      <View className="flex-1" />

      <PrimaryButton onPress={save} disabled={busy || (!weight && !waist)}>
        {busy ? '儲存中…' : '儲存,下一步:早餐'}
      </PrimaryButton>
    </View>
  );
}

function MealStep({ step, day, onDone }: { step: string; day: Today; onDone: () => void }) {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await api.get(`/days/${day.date}/plan`));
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
    } catch (error) {
      Alert.alert('沒有成功', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const markEaten = async () => {
    await act(() => api.patch(`/days/${day.date}/meals/${step}`));
    onDone();
  };

  if (!plan) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View className="flex-1 gap-4">
        <Title sub="還沒有適合這個時段的餐點">{STEP_LABEL[step]}</Title>
        <Card className="gap-2">
          <Text className="text-base text-ink">
            到「餐點」分頁新增一道標記為{STEP_LABEL[step]}的餐點,之後每天就會自動排進來。
          </Text>
        </Card>
        <View className="flex-1" />
        <PrimaryButton onPress={markEaten} disabled={busy}>
          {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完`}
        </PrimaryButton>
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4">
      <View className="gap-1">
        <Hint>今天的{STEP_LABEL[step]}</Hint>
        <Title>{meal.name}</Title>
      </View>

      <Card className="gap-3">
        {groupByCategory(meal.items).map((group) => (
          <View key={group.category} className="gap-1">
            <Text className="text-sm text-muted">{group.label}</Text>
            {group.items.map((item) => (
              <View key={item.id} className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-base text-ink">{formatGrams(item)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`換掉${item.food.name}`}
                  onPress={() =>
                    router.push(
                      `/meals/swap-today?date=${day.date}&slot=${step}&item=${item.id}&food=${item.food.id}&grams=${item.grams}`,
                    )
                  }
                  className="min-h-[44px] justify-center rounded-field bg-fill px-3"
                >
                  <Text className="text-base text-ink">換</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <View className="flex-row items-baseline justify-between border-t border-line pt-3">
          <Text className="text-base font-semibold text-ink">整份</Text>
          <Text className="text-base font-semibold text-ink">
            {Math.round(meal.nutrients.kcal)} 大卡
          </Text>
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

      <View className="flex-1" />

      <PrimaryButton onPress={markEaten} disabled={busy}>
        {busy ? '處理中…' : `標記${STEP_LABEL[step]}吃完`}
      </PrimaryButton>
    </View>
  );
}

function WorkoutStep({ day, onDone }: { day: Today; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const complete = async () => {
    setBusy(true);
    try {
      await api.patch(`/days/${day.date}`, { workout_done: true });
      onDone();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 gap-4">
      <Title sub="課表逐組打勾會接在這裡">運動</Title>
      <Card className="gap-2">
        <Text className="text-base text-ink">目前先標記做完,讓流程往下走。</Text>
      </Card>
      <View className="flex-1" />
      <PrimaryButton onPress={complete} disabled={busy}>
        {busy ? '處理中…' : '標記運動完成'}
      </PrimaryButton>
    </View>
  );
}

function DoneStep({ day }: { day: Today }) {
  const remaining = day.targets.kcal - day.flow.eaten_kcal;

  return (
    <View className="flex-1 gap-4">
      <Title sub="今天的流程都走完了">辛苦了</Title>

      <Card className="gap-3">
        <Text className="font-display text-4xl font-bold text-ink">
          {Math.round(day.flow.eaten_kcal).toLocaleString()}{' '}
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
