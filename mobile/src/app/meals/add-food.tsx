import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Card, Chip, Field, Hint, PrimaryButton, Rows, Screen, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { color } from '@/theme/tokens';

type Food = Schema<'FoodOut'>;
type Category = Schema<'FoodCategoryOut'>;

export default function AddFood() {
  const { category, meal_id, destination = 'meal', date, slot } = useLocalSearchParams<{
    category?: string;
    meal_id?: string;
    destination?: 'meal' | 'day';
    date?: string;
    slot?: string;
  }>();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(category ?? 'all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/food-categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const search = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (filter !== 'all') params.set('category', filter);
      setFoods(await api.get(`/foods?${params}`));
    } catch (error) {
      Alert.alert('搜尋失敗', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [query, filter]);

  useEffect(() => {
    const timer = setTimeout(search, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const choose = (food: Food) => {
    setPicked(food);
    // Default to the usual portion, which is what the spec says a fresh pick starts at.
    setGrams(String(Math.round(food.usual_grams)));
  };

  const add = async () => {
    if (!picked) return;
    const portion = Number(grams) || picked.usual_grams;
    setBusy(true);
    try {
      if (destination === 'day') {
        if (!date || !slot) throw new Error('找不到要加入的日期或餐次。');
        await api.post(`/days/${date}/plan/${slot}/items`, { food_id: picked.id, grams: portion });
      } else {
        draft.addItem(picked, portion);
      }
      router.back();
    } catch (error) {
      Alert.alert('加入失敗', error instanceof ApiError ? error.message : error instanceof Error ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const label = categories.find((c) => c.id === filter)?.name;
  const kcal = picked ? Math.round((picked.per_100g.kcal * (Number(grams) || 0)) / 100) : 0;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ {destination === 'day' ? '今日流程' : '編輯餐點'}</Text>
      </Pressable>

       <Title>{label ? `加入${label}` : '加入食物'}</Title>

        {destination === 'meal' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/meals/photo?destination=meal&meal_id=${meal_id ?? 'new'}`)}
            className="min-h-[44px] justify-center"
          >
            <Text className="text-base text-primary">⌁ 改用餐點照片辨識</Text>
          </Pressable>
        ) : null}

       <Field value={query} onChangeText={setQuery} placeholder="搜尋食物名稱或別名" />

      <View className="flex-row flex-wrap gap-2">
        <Chip label="全部" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={filter === c.id}
            onPress={() => setFilter(c.id)}
          />
        ))}
      </View>

      {foods === null ? (
        <ActivityIndicator color={color.primary} />
      ) : foods.length === 0 ? (
        <Card>
          <Hint>找不到符合的食物。換個關鍵字,或到食物庫新增自訂食物。</Hint>
        </Card>
      ) : (
        <Card className="px-0 py-0">
          <Rows>
            {foods.map((food) => (
            <FoodOptionRow
              key={food.id}
              name={food.name}
              detail={summarise(food)}
              badges={[{ label: categories.find((c) => c.id === food.category_id)?.name ?? '', tone: 'primary' }]}
              selected={picked?.id === food.id}
              onPress={() => choose(food)}
            />
            ))}
          </Rows>
        </Card>
      )}

      {picked ? (
        <Card className="gap-3 border-primary">
          <Text className="text-base font-semibold text-ink">{picked.name}</Text>
          <View className="flex-row items-end gap-3">
            <Field
              label="份量"
              value={grams}
              onChangeText={setGrams}
              suffix="g"
              keyboardType="decimal-pad"
            />
            <Text className="font-display text-3xl font-bold text-ink">{kcal} 大卡</Text>
          </View>
          <PrimaryButton onPress={add} disabled={!grams || busy}>
            {busy ? '加入中…' : `加入${label ?? '食物'}`}
          </PrimaryButton>
        </Card>
      ) : null}
    </Screen>
  );
}

function summarise(food: Food): string {
  const { kcal, protein_g, fat_g, carb_g } = food.per_100g;
  const base =
    food.grams_per_unit && food.unit === 'piece' ? `每顆 ${food.grams_per_unit} g` : '每 100 g';
  const factor = food.grams_per_unit && food.unit === 'piece' ? food.grams_per_unit / 100 : 1;
  const r = (n: number) => Math.round(n * factor);
  return `${base} ${r(kcal)} 大卡,蛋白質 ${r(protein_g)}、脂肪 ${r(fat_g)}、碳水 ${r(carb_g)} g`;
}
