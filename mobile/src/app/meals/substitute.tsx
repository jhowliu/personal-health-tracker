import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Card, Hint, PrimaryButton, Screen, Segmented, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { color } from '@/theme/tokens';

type Exchange = Schema<'ExchangeOut'>;
type Food = Schema<'FoodOut'>;

const BASIS_LABEL: Record<string, string> = {
  carb: '等碳水',
  protein: '等蛋白質',
  kcal: '等熱量',
};

const CATEGORY_LABEL: Record<string, string> = {
  staple: '主食',
  protein: '蛋白質',
  vegetable: '蔬菜',
  fruit: '水果',
  fat_sauce: '油脂與醬料',
};

export default function Substitute() {
  const { key, food: foodId, grams } = useLocalSearchParams<{
    key: string;
    food: string;
    grams: string;
  }>();

  const [source, setSource] = useState<Food | null>(null);
  const [defaultBasis, setDefaultBasis] = useState<string>('kcal');
  const [basis, setBasis] = useState<string | null>(null);
  const [options, setOptions] = useState<Exchange[] | null>(null);
  const [picked, setPicked] = useState<Exchange | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [foods, categories] = await Promise.all([
          api.get(`/foods?q=`),
          api.get('/food-categories'),
        ]);
        const current = (foods as Food[]).find((f) => f.id === foodId) ?? null;
        setSource(current);
        const category = (categories as Schema<'FoodCategoryOut'>[]).find(
          (c) => c.id === current?.category_id,
        );
        setDefaultBasis(category?.swap_by ?? 'kcal');
      } catch {
        setSource(null);
      }
    })();
  }, [foodId]);

  const load = useCallback(async () => {
    try {
      const chosen = basis ?? defaultBasis;
      setOptions(await api.get(`/foods/${foodId}/exchanges?grams=${grams}&match=${chosen}`));
      setPicked(null);
    } catch (error) {
      Alert.alert('讀不到替換選項', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [foodId, grams, basis, defaultBasis]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirm = () => {
    if (!picked) return;
    draft.replaceItem(key, picked.food, picked.grams);
    router.back();
  };

  const active = basis ?? defaultBasis;
  const alternatives = defaultBasis === 'kcal' ? ['kcal'] : [defaultBasis, 'kcal'];

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ 編輯餐點</Text>
      </Pressable>

      <Title>替換{source ? CATEGORY_LABEL[source.category_id] ?? '食物' : '食物'}</Title>

      {source ? (
        <Card className="gap-1 bg-fill">
          <Text className="text-sm text-muted">目前</Text>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-base font-semibold text-ink">{source.name}</Text>
            <Text className="text-base font-semibold text-ink">{Math.round(Number(grams))} g</Text>
          </View>
          <Hint>
            蛋白質 {Math.round((source.per_100g.protein_g * Number(grams)) / 100)} g,
            {Math.round((source.per_100g.kcal * Number(grams)) / 100)} 大卡
          </Hint>
        </Card>
      ) : null}

      {alternatives.length > 1 ? (
        <View className="gap-1">
          <Text className="text-sm text-muted">換算方式</Text>
          <Segmented
            value={active}
            onChange={setBasis}
            options={alternatives.map((b) => ({ value: b, label: BASIS_LABEL[b] }))}
          />
        </View>
      ) : null}

      <Hint>同分類的食物,克數已自動換算</Hint>

      {options === null ? (
        <ActivityIndicator color={color.primary} />
      ) : (
        <Card className="px-0 py-0">
          {options.map((option) => (
            <FoodOptionRow
              key={option.food.id}
              name={option.food.name}
              grams={`${Math.round(option.grams)} g`}
              badges={badgesFor(option, active)}
              note={
                option.capped
                  ? `已到常見份量上限,${BASIS_LABEL[active].replace('等', '')}會比原本少`
                  : undefined
              }
              selected={picked?.food.id === option.food.id}
              onPress={() => setPicked(option)}
            />
          ))}
        </Card>
      )}

      <PrimaryButton onPress={confirm} disabled={!picked}>
        確認替換
      </PrimaryButton>
    </Screen>
  );
}

function badgesFor(option: Exchange, basis: string) {
  const matched = basis === 'protein' ? option.delta.protein_g : option.delta.carb_g;
  const badges: { label: string; tone: 'neutral' | 'primary' | 'good' | 'warm' }[] = [];

  if (basis !== 'kcal') {
    const nutrient = basis === 'protein' ? '蛋白質' : '碳水';
    badges.push(
      Math.abs(matched) < 1
        ? { label: `${nutrient} 相同`, tone: 'primary' }
        : { label: `${nutrient} ${matched < 0 ? '少' : '多'} ${Math.abs(Math.round(matched))} g`, tone: 'warm' },
    );
  }

  const kcal = Math.round(option.delta.kcal);
  badges.push({
    label: kcal === 0 ? '熱量相同' : `熱量 ${kcal > 0 ? '+' : ''}${kcal} 大卡`,
    tone: kcal > 0 ? 'warm' : 'good',
  });

  return badges;
}
