import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { MealCard } from '@/components/MealCard';
import { Card, Chip, Empty, Hint, Rows, Screen, Segmented, Title } from '@/components/ui';
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
  carb: '換成同分類食物時,會依「碳水」換算等量克數。',
  protein: '換成同分類食物時,會依「蛋白質」換算等量克數。',
  kcal: '換成同分類食物時,會依「熱量」換算等量克數。',
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
            <Title>餐點</Title>
            <View className="flex-row items-center gap-2">
              {tab === 'mine' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="用照片記錄今天吃的食物"
                  onPress={() => router.navigate('/meals/photo?destination=today')}
                  className="h-11 w-11 items-center justify-center rounded-field bg-fill"
                >
                  <Text className="text-xl text-primary">⌁</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate(tab === 'mine' ? '/meals/new' : '/foods/new')}
                className="min-h-[44px] justify-center rounded-field bg-primary px-4"
              >
                <Text className="text-base font-semibold text-white">
                  {tab === 'mine' ? '+ 新增餐點' : '+ 新增食物'}
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
  const { profile, reload } = useSession();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [slot, setSlot] = useState('all');
  const [busy, setBusy] = useState(false);

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

  const toggleAutoAssign = async (next: boolean) => {
    setBusy(true);
    try {
      await api.patch('/users/me/profile', { auto_assign_meals: next });
      await reload();
    } catch (error) {
      Alert.alert('改不了', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {SLOT_FILTERS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            selected={slot === option.id}
            onPress={() => setSlot(option.id)}
          />
        ))}
      </View>

      {profile?.profile.auto_scale_carbs ? <CarbScaleNotice /> : null}

      <Card className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5 pr-4">
          <Text className="text-base font-semibold text-ink">每日自動分配</Text>
          <Hint>
            每天從你的餐點裡隨機排早午晚餐。想換其中一樣,在今日流程按「換」就好。
          </Hint>
        </View>
        <Switch
          value={profile?.profile.auto_assign_meals ?? true}
          onValueChange={toggleAutoAssign}
          disabled={busy}
          trackColor={{ true: color.good, false: color.line }}
        />
      </Card>

      {meals === null ? (
        <ActivityIndicator color={color.primary} />
      ) : meals.length === 0 ? (
        <Empty>還沒有自己的餐點,按右上角新增一道</Empty>
      ) : (
        <Rows>
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onPress={() => router.navigate(`/meals/${meal.id}`)}
            />
          ))}
        </Rows>
      )}
    </>
  );
}

function CarbScaleNotice() {
  const { profile } = useSession();
  const scale = profile?.targets.carb_scale ?? 1;
  if (Math.abs(scale - 1) < 0.02) return null;

  const direction = scale < 1 ? '減少' : '增加';
  const percent = Math.round(Math.abs(1 - scale) * 100);

  return (
    <Card className="gap-2 border-warm bg-warm-soft">
      <Text className="text-base font-semibold text-ink">
        熱量目標更新為 {profile?.targets.kcal.toLocaleString()} 大卡
      </Text>
      <Text className="text-base text-ink">
        所有餐點的主食份量已自動{direction}約 {percent}%,蛋白質和蔬菜不變。
      </Text>
      <Hint>編輯餐點時看到的仍是基準克數。</Hint>
    </Card>
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
            {foods.map((food) => (
              <View
                key={food.id}
                className="flex-row items-start justify-between gap-3 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-ink">{food.name}</Text>
                  <Text className="text-sm text-muted">{describe(food)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-muted">常用</Text>
                  <Text className="text-sm text-ink">{usualPortion(food)}</Text>
                </View>
              </View>
            ))}
          </Rows>
        </Card>
      )}
    </>
  );
}

function describe(food: Food): string {
  const per = food.grams_per_unit && food.unit === 'piece' ? `每顆 ${food.grams_per_unit} g` : '每 100 g';
  const { kcal, protein_g, fat_g, carb_g } = food.per_100g;
  const factor = food.grams_per_unit && food.unit === 'piece' ? food.grams_per_unit / 100 : 1;
  const round = (n: number) => Math.round(n * factor);
  return `${per} ${round(kcal)} 大卡,蛋白質 ${round(protein_g)}、脂肪 ${round(fat_g)}、碳水 ${round(carb_g)} g`;
}

function usualPortion(food: Food): string {
  if (food.grams_per_unit && food.unit === 'piece') {
    return `${Math.round(food.usual_grams / food.grams_per_unit)} 顆`;
  }
  if (food.grams_per_unit && food.unit === 'scoop') {
    const scoops = food.usual_grams / food.grams_per_unit;
    return scoops % 1 === 0 ? `${scoops} 匙` : `${scoops.toFixed(1)} 匙`;
  }
  if (food.unit === 'ml' && food.grams_per_unit) {
    return `${Math.round(food.usual_grams / food.grams_per_unit)} ml`;
  }
  return `${Math.round(food.usual_grams)} g`;
}
