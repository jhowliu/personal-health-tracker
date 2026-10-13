/**
 * Saving what was eaten at one of today's slots as a new meal of the user's own.
 *
 * The other half of 從我的餐點選一道: photograph a dish once, save it, and next time it is a
 * single tap. Sibling of workouts/save-today.tsx. Custom items carry only calories, which a
 * meal cannot hold, so they are left out and said so.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Plan = Schema<'DayPlanOut'>;
type Slot = Plan['meals'][number];
type MealTime = Schema<'MealIn'>['meal_times'][number];

const SLOTS: MealTime[] = ['breakfast', 'lunch', 'dinner'];

export default function SaveTodayMeal() {
  const { t } = useI18n();
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
        setName(found.name ? t('meals.saveToday.myVersion', { name: found.name }) : names.slice(0, 3).join(' · '));
      })
      .catch((error) =>
        Alert.alert(t('meals.saveToday.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'), [
          { text: t('meals.saveToday.returnToday'), onPress: () => backOrReplace('/today') },
        ]),
      );
    return () => {
      live = false;
    };
  }, [date, slot, t]);

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
      Alert.alert(t('meals.saveToday.savedTitle'), t('meals.saveToday.savedBody'));
    } catch (error) {
      Alert.alert(t('common.errors.saveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
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
          {t('meals.saveToday.title')}
        </PrimaryButton>
      }
    >
      <BackLink label={t('common.labels.today')} disabled={busy} onPress={() => backOrReplace('/today')} />
      <Title sub={t('meals.saveToday.subtitle', { day: date ? dayWord(date) : t('common.labels.today') })}>
        {t('meals.saveToday.title')}
      </Title>
      <Field label={t('meals.saveToday.mealName')} value={name} onChangeText={setName} placeholder={t('meals.saveToday.mealNamePlaceholder')} />
      <View className="gap-2">
        <Text className="text-sm text-muted">{t('meals.saveToday.suitableTimes')}</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((option) => (
            <Chip
              key={option}
              label={t(`common.mealTimes.${option}`)}
              selected={times.includes(option)}
              onPress={() => toggle(option)}
            />
          ))}
        </View>
      </View>
      <Card className="gap-2">
        <Text className="text-base text-ink">
          {t(foods.length === 1 ? 'common.counts.foods.one' : 'common.counts.foods.other', { count: foods.length })}
        </Text>
        {foods.map((item) => (
          <Hint key={item.id}>
            {item.food!.name}　{Math.round(item.grams!)} g
          </Hint>
        ))}
      </Card>
      {leftOut > 0 ? <Hint>{t('meals.saveToday.excludedItems', { count: leftOut })}</Hint> : null}
    </Screen>
  );
}
