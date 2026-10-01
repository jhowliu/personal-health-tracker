/**
 * Putting one of the user's saved meals on a day's slot, whole.
 *
 * For the dishes someone cooks again and again: one tap instead of a photo or food by food.
 * Portions arrive scaled to the day's target; the meal itself is left alone.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { BackLink, Card, Empty, Hint, Rows, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Meal = Schema<'MealOut'>;

const SLOT_LABEL: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };

export default function PickMealForToday() {
  const { date, slot } = useLocalSearchParams<{ date: string; slot: string }>();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const slotLabel = SLOT_LABEL[slot] ?? '這餐';

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
        Alert.alert('讀不到我的餐點', error instanceof ApiError ? error.message : '請稍後再試。');
      });
    return () => {
      live = false;
    };
  }, [slot]);

  const pick = async (meal: Meal) => {
    if (!date || !slot) return;
    setBusyId(meal.id);
    try {
      await api.post(`/days/${date}/plan/${slot}/meal`, { meal_id: meal.id });
      backOrReplace('/today');
    } catch (error) {
      Alert.alert('加入失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <BackLink label="今天" disabled={busyId !== null} onPress={() => backOrReplace('/today')} />
      <Title sub={`加到${date ? dayWord(date) : '今天'}的${slotLabel}；主食份量會依今天的目標調整。`}>
        從我的餐點選一道
      </Title>

      {meals === null ? (
        <ActivityIndicator color={color.primary} />
      ) : meals.length === 0 ? (
        <Empty>還沒有存過餐點。記錄一餐之後，可以在今天的畫面按「存成我的餐點」。</Empty>
      ) : (
        <Card className="px-0 py-0">
          <Rows>
            {meals.map((meal) => (
              <FoodOptionRow
                key={meal.id}
                name={meal.name}
                detail={meal.items.map((item) => item.food.name).join('・')}
                trailing={busyId === meal.id ? '加入中…' : `${Math.round(meal.nutrients.kcal)} 大卡`}
                onPress={busyId === null ? () => pick(meal) : undefined}
              />
            ))}
          </Rows>
        </Card>
      )}
      <Hint>只會加入這一天；之後改這道餐點，不會影響已經記錄的內容。</Hint>
    </Screen>
  );
}
