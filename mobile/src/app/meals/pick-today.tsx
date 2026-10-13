/**
 * Putting one of the user's saved meals on a day's slot, whole.
 *
 * For the dishes someone cooks again and again: one tap instead of a photo or food by food.
 * Portions arrive as saved; the meal itself is left alone.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { PlusIcon } from '@/components/icons';
import { BackLink, Card, Empty, Hint, PrimaryButton, Rows, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Meal = Schema<'MealOut'>;

export default function PickMealForToday() {
  const { t } = useI18n();
  const { date, slot } = useLocalSearchParams<{ date: string; slot: string }>();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const slotLabel = slot === 'breakfast'
    ? t('common.mealTimes.breakfast')
    : slot === 'lunch'
      ? t('common.mealTimes.lunch')
      : slot === 'dinner'
        ? t('common.mealTimes.dinner')
        : t('common.mealTimes.thisMeal');

  useEffect(() => {
    let live = true;
    api
      .get('/meals')
      .then((result: Meal[]) => {
        // Meals meant for this slot first; the rest stay pickable, people eat breakfast at night.
        const suited = (meal: Meal) => meal.meal_times.includes(slot as Meal['meal_times'][number]);
        if (live) setMeals([...result].sort((a, b) => Number(suited(b)) - Number(suited(a))));
      })
      .catch((error) => {
        if (live) setMeals([]);
        Alert.alert(t('meals.pickSaved.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
      });
    return () => {
      live = false;
    };
  }, [slot, t]);

  const pick = async (meal: Meal) => {
    if (!date || !slot) return;
    setBusyId(meal.id);
    try {
      await api.post(`/days/${date}/plan/${slot}/meal`, { meal_id: meal.id });
      backOrReplace('/today');
    } catch (error) {
      Alert.alert(t('common.errors.addFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <BackLink label={t('common.labels.today')} disabled={busyId !== null} onPress={() => backOrReplace('/today')} />
      <Title sub={t('meals.pickSaved.subtitle', { day: date ? dayWord(date) : t('common.labels.today'), meal: slotLabel })}>
        {t('meals.pickSaved.title')}
      </Title>

      {meals === null ? (
        <ActivityIndicator color={color.primary} />
      ) : meals.length === 0 ? (
        <Empty
          action={
            // A first-time user lands here with nothing to pick; the catalog is the way on.
            <PrimaryButton
              tone="plain"
              icon={PlusIcon}
              onPress={() =>
                router.replace({ pathname: '/meals/add-food', params: { destination: 'day', date, slot } })
              }
            >
              {t('meals.pickSaved.useLibrary')}
            </PrimaryButton>
          }
        >
          {t('meals.pickSaved.empty')}
        </Empty>
      ) : (
        <Card className="px-0 py-0">
          <Rows>
            {meals.map((meal) => (
              <FoodOptionRow
                key={meal.id}
                name={meal.name}
                detail={meal.items.map((item) => item.food.name).join('・')}
                trailing={busyId === meal.id ? t('common.states.adding') : `${Math.round(meal.nutrients.kcal)} ${t('common.units.kcal')}`}
                onPress={busyId === null ? () => pick(meal) : undefined}
              />
            ))}
          </Rows>
        </Card>
      )}
      {meals?.length ? <Hint>{t('meals.pickSaved.dayOnlyHint')}</Hint> : null}
    </Screen>
  );
}
