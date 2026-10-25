import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { MealCard } from '@/components/MealCard';
import { ShowMore, usePaged } from '@/components/paging';
import { CameraIcon, ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Chip, Empty, HeaderAddButton, HeaderIconButton, Hint, Rows, Screen, Segmented, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { byCategoryOrder } from '@/meals/order';
import { describeFood, formatPortion } from '@/meals/portion';
import { color } from '@/theme/tokens';

type Meal = Schema<'MealOut'>;
type Food = Schema<'FoodOut'>;
type Category = Schema<'FoodCategoryOut'>;

type Tab = 'mine' | 'library';

export default function MealsScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('mine');

  return (
    <Screen
      footerSafeArea={false}
      pinnedHeader={
        <>
          <Title
            action={
              <View className="flex-row items-center gap-2">
                {tab === 'mine' ? (
                  <HeaderIconButton
                    icon={CameraIcon}
                    accessibilityLabel={t('meals.home.photoAccessibility')}
                    onPress={() => router.navigate('/meals/photo?destination=today')}
                  />
                ) : null}
                <HeaderAddButton
                  label={t('common.actions.create')}
                  accessibilityLabel={tab === 'mine' ? t('meals.home.addMeal') : t('meals.home.addFood')}
                  onPress={() => router.navigate(tab === 'mine' ? '/meals/new' : '/foods/new')}
                />
              </View>
            }
          >
            {t('meals.home.title')}
          </Title>
          <Segmented
            value={tab}
            onChange={setTab}
            tone="soft"
            options={[
              { value: 'mine', label: t('meals.home.savedMeals') },
              { value: 'library', label: t('meals.home.foodLibrary') },
            ]}
          />
        </>
      }
    >
      {tab === 'mine' ? <MyMeals /> : <FoodLibrary />}
    </Screen>
  );
}

function MyMeals() {
  const { t } = useI18n();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [slot, setSlot] = useState('all');

  const load = useCallback(async () => {
    try {
      const query = slot === 'all' ? '' : `?meal_time=${slot}`;
      setMeals(await api.get(`/meals${query}`));
    } catch (error) {
      Alert.alert(t('meals.home.loadMealsFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    }
  }, [slot, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {[
          { id: 'all', label: t('common.labels.all') },
          { id: 'breakfast', label: t('common.mealTimes.breakfast') },
          { id: 'lunch', label: t('common.mealTimes.lunch') },
          { id: 'dinner', label: t('common.mealTimes.dinner') },
        ].map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={slot === option.id}
            onPress={() => setSlot(option.id)}
          />
        ))}
      </View>

      {meals === null ? (
        <ActivityIndicator color={color.primary} />
      ) : meals.length === 0 ? (
        <Empty sticker="bowl">{t('meals.home.noSavedMeals')}</Empty>
      ) : (
        <View className="gap-3">
          {meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} onOpen={() => router.navigate(`/meals/${meal.id}`)} />
          ))}
        </View>
      )}
    </>
  );
}

function FoodLibrary() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [category, setCategory] = useState('all');

  const load = useCallback(async () => {
    try {
      const query = category === 'all' ? '' : `?category=${category}`;
      const [list, cats] = await Promise.all([
        api.get(`/foods${query}`),
        api.get('/food-categories'),
      ]);
      setFoods(list);
      setCategories(cats);
    } catch (error) {
      Alert.alert(t('meals.home.loadFoodsFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    }
  }, [category, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selected = categories.find((c) => c.id === category);
  const swapHint: Record<string, string> = {
    carb: t('meals.home.swapHintCarbs'),
    protein: t('meals.home.swapHintProtein'),
    kcal: t('meals.home.swapHintCalories'),
    none: t('meals.home.swapHintNone'),
  };
  const ordered = useMemo(() => (foods ? byCategoryOrder(foods, categories) : []), [foods, categories]);
  const { visible, remaining, showMore } = usePaged(ordered, ordered);

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        <Chip label={t('common.labels.all')} selected={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>

      {selected ? <Hint>{swapHint[selected.swap_by]}</Hint> : null}

      {foods === null ? (
        <ActivityIndicator color={color.primary} />
      ) : foods.length === 0 ? (
        <Empty>{t('meals.home.noFoodsInCategory')}</Empty>
      ) : (
        <Card className="py-0">
          <Rows>
            {visible.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={t('meals.home.editFood', { name: food.name })}
                onPress={() => router.navigate({ pathname: '/foods/[id]', params: { id: food.id } })}
                className="min-h-[52px] flex-row items-center justify-between gap-3 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-base text-ink">{food.name}</Text>
                  <Text className="text-sm text-muted">{describeFood(food)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-muted">{t('common.states.common')}</Text>
                  <Text className="text-sm text-ink">{formatPortion(food, food.usual_grams)}</Text>
                </View>
                <ChevronIcon direction="right" size={16} tint={color.muted} />
              </Pressable>
            ))}
          </Rows>
        </Card>
      )}

      <ShowMore remaining={remaining} onPress={showMore} />
    </>
  );
}
