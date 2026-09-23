/**
 * Swapping one food on *today's plate*.
 *
 * Sibling of substitute.tsx, which edits a meal template. This one writes straight to
 * the day's plan, so the change lands on today only and leaves the recipe alone.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Card, Hint, PrimaryButton, Rows, Screen, Segmented, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

type Exchange = Schema<'ExchangeOut'>;
type Category = Schema<'FoodCategoryOut'>;

const BASIS_LABEL: Record<string, string> = {
  carb: '等碳水',
  protein: '等蛋白質',
  kcal: '等熱量',
};

export default function SwapToday() {
  const params = useLocalSearchParams<{
    date: string;
    slot: string;
    item: string;
    food: string;
    grams: string;
  }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultBasis, setDefaultBasis] = useState('kcal');
  const [basis, setBasis] = useState<string | null>(null);
  const [options, setOptions] = useState<Exchange[] | null>(null);
  const [picked, setPicked] = useState<Exchange | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cats, foods] = await Promise.all([
          api.get('/food-categories'),
          api.get('/foods'),
        ]);
        setCategories(cats);
        const source = (foods as Schema<'FoodOut'>[]).find((f) => f.id === params.food);
        const category = (cats as Category[]).find((c) => c.id === source?.category_id);
        setDefaultBasis(category?.swap_by ?? 'kcal');
      } catch {
        setDefaultBasis('kcal');
      }
    })();
  }, [params.food]);

  const load = useCallback(async () => {
    try {
      const chosen = basis ?? defaultBasis;
      setOptions(
        await api.get(`/foods/${params.food}/exchanges?grams=${params.grams}&match=${chosen}`),
      );
      setPicked(null);
    } catch (error) {
      Alert.alert('讀不到替換選項', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [params.food, params.grams, basis, defaultBasis]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirm = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await api.patch(`/days/${params.date}/plan/${params.slot}/items`, {
        item_id: params.item,
        to_food_id: picked.food.id,
        match: basis ?? defaultBasis,
      });
      router.back();
    } catch (error) {
      Alert.alert('換不了', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const active = basis ?? defaultBasis;
  const choices = defaultBasis === 'kcal' ? [] : [defaultBasis, 'kcal'];

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ 今日流程</Text>
      </Pressable>

      <Title sub="只換今天這一次,不會改到原本的餐點">換一樣食物</Title>

      {choices.length ? (
        <View className="gap-1">
          <Text className="text-sm text-muted">換算方式</Text>
          <Segmented
            value={active}
            onChange={setBasis}
            options={choices.map((b) => ({ value: b, label: BASIS_LABEL[b] }))}
          />
        </View>
      ) : null}

      <Hint>同分類的食物,克數已自動換算</Hint>

      {options === null ? (
        <ActivityIndicator color={color.primary} />
      ) : (
        <Card className="px-0 py-0">
          <Rows>
            {options.map((option) => (
            <FoodOptionRow
              key={option.food.id}
              name={option.food.name}
              grams={`${Math.round(option.grams)} g`}
              badges={[
                {
                  label:
                    Math.round(option.delta.kcal) === 0
                      ? '熱量相同'
                      : `熱量 ${option.delta.kcal > 0 ? '+' : ''}${Math.round(option.delta.kcal)} 大卡`,
                  tone: option.delta.kcal > 0 ? 'warm' : 'good',
                },
              ]}
              badgesBelow
              note={option.capped ? '已到常見份量上限' : undefined}
              selected={picked?.food.id === option.food.id}
              onPress={() => setPicked(option)}
            />
            ))}
          </Rows>
        </Card>
      )}

      <PrimaryButton onPress={confirm} disabled={!picked || busy}>
        {busy ? '處理中…' : '換成這個'}
      </PrimaryButton>

      {categories.length === 0 ? null : (
        <Hint>想永久替換,到「餐點」分頁編輯這道餐點。</Hint>
      )}
    </Screen>
  );
}
