/**
 * Saving what was eaten at one of today's slots as a new meal of the user's own.
 *
 * The other half of 從我的餐點選一道: photograph a dish once, save it, and next time it is a
 * single tap. Sibling of workouts/save-today.tsx. Custom items carry only calories, which a
 * meal cannot hold, so they are left out and said so.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { BackLink, Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Plan = Schema<'DayPlanOut'>;
type Slot = Plan['meals'][number];
type MealTime = Schema<'MealIn'>['meal_times'][number];

const SLOTS: { id: MealTime; label: string }[] = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
];

export default function SaveTodayMeal() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: MealTime }>();
  const [meal, setMeal] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [times, setTimes] = useState<MealTime[]>(slot ? [slot] : []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    let live = true;
    api
      .get(`/days/${date}/plan`)
      .then((plan: Plan) => {
        const found = plan.meals.find((candidate) => candidate.meal_time === slot);
        if (!live || !found) return;
        setMeal(found);
        const names = found.items.flatMap((item) => (item.food ? [item.food.name] : []));
        setName(found.name ? `${found.name}・我的版本` : names.slice(0, 3).join('・'));
      })
      .catch((error) =>
        Alert.alert('讀不到這一餐', error instanceof ApiError ? error.message : '請稍後再試。', [
          { text: '返回今天', onPress: () => backOrReplace('/today') },
        ]),
      );
    return () => {
      live = false;
    };
  }, [date, slot]);

  const foods = meal?.items.filter((item) => item.food && item.grams !== null) ?? [];
  const leftOut = (meal?.items.length ?? 0) - foods.length;
  const toggle = (time: MealTime) =>
    setTimes((current) => (current.includes(time) ? current.filter((t) => t !== time) : [...current, time]));

  const save = async () => {
    if (!name.trim() || !times.length || !foods.length) return;
    setBusy(true);
    try {
      await api.post('/meals', {
        name: name.trim(),
        meal_times: times,
        items: foods.map((item) => ({ food_id: item.food!.id, grams: item.grams })),
      });
      backOrReplace('/today');
      Alert.alert('已存成我的餐點', '下次可以從「加入」→「從我的餐點選一道」直接加入。');
    } catch (error) {
      Alert.alert('儲存失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  if (!meal) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <PrimaryButton onPress={save} disabled={!name.trim() || !times.length || !foods.length} busy={busy}>
          存成我的餐點
        </PrimaryButton>
      }
    >
      <BackLink label="今天" disabled={busy} onPress={() => backOrReplace('/today')} />
      <Title sub={`把${date ? dayWord(date) : '今天'}這一餐的食物和份量存起來，之後可以整道加入。`}>
        存成我的餐點
      </Title>
      <Field label="餐點名稱" value={name} onChangeText={setName} placeholder="例如：梅花豬豆腐飯" />
      <View className="gap-2">
        <Text className="text-sm text-muted">適合的時段</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={times.includes(option.id)}
              onPress={() => toggle(option.id)}
            />
          ))}
        </View>
      </View>
      <Card className="gap-2">
        <Text className="text-base font-semibold text-ink">{foods.length} 樣食物</Text>
        {foods.map((item) => (
          <Hint key={item.id}>
            {item.food!.name}　{Math.round(item.grams!)} g
          </Hint>
        ))}
      </Card>
      {leftOut > 0 ? <Hint>{leftOut} 項只有熱量的自訂項目不會存進餐點。</Hint> : null}
    </Screen>
  );
}
