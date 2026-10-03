import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { MealCard } from '@/components/MealCard';
import { ShowMore, usePaged } from '@/components/paging';
import { CameraIcon, ChevronIcon, PlusIcon } from '@/components/icons';
import { Card, Chip, Empty, Hint, Rows, Screen, Segmented } from '@/components/ui';
import { byCategoryOrder } from '@/meals/order';
import { describeFood, formatPortion } from '@/meals/portion';
import { color } from '@/theme/tokens';

type Meal = Schema<'MealOut'>;
type Food = Schema<'FoodOut'>;
type Category = Schema<'FoodCategoryOut'>;

type Tab = 'mine' | 'library';

const SLOT_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
];

const SWAP_HINT: Record<string, string> = {
  carb: '換成同分類食物時，會依「碳水」換算等量克數。',
  protein: '換成同分類食物時，會依「蛋白質」換算等量克數。',
  kcal: '換成同分類食物時，會依「熱量」換算等量克數。',
  none: '這個分類不做等量換算。',
};

export default function MealsScreen() {
  const [tab, setTab] = useState<Tab>('mine');

  return (
    <Screen
      footerSafeArea={false}
      pinnedHeader={
        <>
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
              餐點
            </Text>
            <View className="flex-row items-center gap-2">
              {tab === 'mine' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="用照片記錄今天吃的食物"
                  onPress={() => router.navigate('/meals/photo?destination=today')}
                  className="h-11 w-11 items-center justify-center rounded-field bg-fill"
                >
                  <CameraIcon size={22} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate(tab === 'mine' ? '/meals/new' : '/foods/new')}
                className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-field bg-primary px-4"
              >
                <PlusIcon size={18} tint={color.surface} />
                <Text className="text-base font-semibold text-white">
                  {tab === 'mine' ? '新增餐點' : '新增食物'}
                </Text>
              </Pressable>
            </View>
          </View>
          <Segmented
            value={tab}
            onChange={setTab}
            tone="soft"
            options={[
              { value: 'mine', label: '我的餐點' },
              { value: 'library', label: '食物庫' },
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
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [slot, setSlot] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const query = slot === 'all' ? '' : `?meal_time=${slot}`;
      setMeals(await api.get(`/meals${query}`));
    } catch (error) {
      Alert.alert('讀不到餐點', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [slot]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const removeMeal = (meal: Meal) =>
    Alert.alert('刪除餐點', '之後就不能從我的餐點選這道。已經吃過的紀錄不受影響。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setRemovingId(meal.id);
            try {
              await api.delete(`/meals/${meal.id}`);
              setMeals((current) => current?.filter((candidate) => candidate.id !== meal.id) ?? current);
              setExpandedId((current) => (current === meal.id ? null : current));
            } catch (error) {
              Alert.alert('刪除失敗', error instanceof ApiError ? error.message : '請稍後再試');
            } finally {
              setRemovingId(null);
            }
          })();
        },
      },
    ]);

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {SLOT_FILTERS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={slot === option.id}
            onPress={() => {
              setSlot(option.id);
              setExpandedId(null);
            }}
          />
        ))}
      </View>

      {meals === null ? (
        <ActivityIndicator color={color.primary} />
      ) : meals.length === 0 ? (
        <Empty>還沒有自己的餐點，按右上角新增一道</Empty>
      ) : (
        <View className="gap-3">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              expanded={expandedId === meal.id}
              busy={removingId === meal.id}
              onToggle={() => setExpandedId((current) => (current === meal.id ? null : meal.id))}
              onEdit={() => router.navigate(`/meals/${meal.id}`)}
              onDelete={() => removeMeal(meal)}
            />
          ))}
        </View>
      )}
    </>
  );
}

function FoodLibrary() {
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
      Alert.alert('讀不到食物庫', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const selected = categories.find((c) => c.id === category);
  const ordered = useMemo(() => (foods ? byCategoryOrder(foods, categories) : []), [foods, categories]);
  const { visible, remaining, showMore } = usePaged(ordered, ordered);

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="全部" selected={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>

      {selected ? <Hint>{SWAP_HINT[selected.swap_by]}</Hint> : null}

      {foods === null ? (
        <ActivityIndicator color={color.primary} />
      ) : foods.length === 0 ? (
        <Empty>這個分類還沒有食物</Empty>
      ) : (
        <Card className="py-0">
          <Rows>
            {visible.map((food) => (
              <Pressable
                key={food.id}
                accessibilityRole="button"
                accessibilityLabel={`編輯${food.name}`}
                onPress={() => router.navigate({ pathname: '/foods/[id]', params: { id: food.id } })}
                className="min-h-[52px] flex-row items-center justify-between gap-3 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-ink">{food.name}</Text>
                  <Text className="text-sm text-muted">{describeFood(food)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-muted">常用</Text>
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
