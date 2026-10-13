import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Text } from '@/components/text';
import { BackLink, Card, Hint, PrimaryButton, Rows, Screen, Segmented, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { draft } from '@/meals/draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Exchange = Schema<'ExchangeOut'>;
type Food = Schema<'FoodOut'>;

const basisLabel = (basis: string) => translate(
  basis === 'carb'
    ? 'meals.substitution.equalCarbs'
    : basis === 'protein'
      ? 'meals.substitution.equalProtein'
      : 'meals.substitution.equalCalories',
);

const categoryLabel = (category: string) => translate(
  `common.foodCategories.${category === 'fat_sauce' ? 'fatSauce' : category}` as 'common.foodCategories.staple',
);

export default function Substitute() {
  const { t } = useI18n();
  const { meal_id: mealId, key, food: foodId, grams } = useLocalSearchParams<{
    meal_id: string;
    key: string;
    food: string;
    grams: string;
  }>();

  const [source, setSource] = useState<Food | null>(null);
  const [defaultBasis, setDefaultBasis] = useState<string>('kcal');
  const [basis, setBasis] = useState<string | null>(null);
  const [options, setOptions] = useState<Exchange[] | null>(null);
  const [picked, setPicked] = useState<Exchange | null>(null);
  const loadVersion = useRef(0);
  const parentRoute = { pathname: '/meals/[id]', params: { id: mealId ?? 'new' } } as const;

  useEffect(() => {
    if (!mealId || !key || !foodId || !grams || !draft.has(mealId)) {
      Alert.alert(t('meals.substitution.missingDraftTitle'), t('meals.substitution.missingDraftBody'), [
        { text: t('meals.photo.returnToMeals'), onPress: () => router.replace('/meals') },
      ]);
    }
  }, [foodId, grams, key, mealId, t]);

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
    if (!foodId || !grams) return;
    const version = ++loadVersion.current;
    setOptions(null);
    setPicked(null);
    try {
      const chosen = basis ?? defaultBasis;
      const result = await api.get(`/foods/${foodId}/exchanges?grams=${grams}&match=${chosen}`);
      if (version === loadVersion.current) setOptions(result);
    } catch (error) {
      Alert.alert(t('meals.substitution.loadOptionsFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    }
  }, [foodId, grams, basis, defaultBasis, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirm = () => {
    if (!picked || !mealId || !draft.has(mealId)) return;
    draft.replaceItem(mealId, key, picked.food, picked.grams);
    backOrReplace(parentRoute);
  };

  const active = basis ?? defaultBasis;
  const alternatives = defaultBasis === 'kcal' ? ['kcal'] : [defaultBasis, 'kcal'];

  return (
    <Screen
      footer={
        picked ? (
          <>
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="flex-1 text-base text-ink" numberOfLines={1}>
                {picked.food.name}
              </Text>
              <Text className="text-base text-muted">{Math.round(picked.grams)} g</Text>
            </View>
            <PrimaryButton onPress={confirm}>{t('meals.substitution.confirm')}</PrimaryButton>
          </>
        ) : undefined
      }
    >
      <BackLink label={t('meals.editor.editTitle')} onPress={() => backOrReplace(parentRoute)} />

      <Title>{t('meals.substitution.title', { category: source ? categoryLabel(source.category_id) : t('meals.substitution.foodFallback') })}</Title>

      {source ? (
        <Card className="gap-1 bg-warm-soft">
          <Text className="text-sm text-muted">{t('meals.substitution.current')}</Text>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-base text-ink">{source.name}</Text>
            <Text className="text-base text-ink">{Math.round(Number(grams))} g</Text>
          </View>
          <Hint>
            {t('common.labels.protein')} {Math.round((source.per_100g.protein_g * Number(grams)) / 100)} g,{' '}
            {Math.round((source.per_100g.kcal * Number(grams)) / 100)} {t('common.units.kcal')}
          </Hint>
        </Card>
      ) : null}

      {alternatives.length > 1 ? (
        <View className="gap-1">
          <Text className="text-sm text-muted">{t('meals.substitution.conversionMethod')}</Text>
          <Segmented
            value={active}
            onChange={setBasis}
            options={alternatives.map((b) => ({ value: b, label: basisLabel(b) }))}
          />
        </View>
      ) : null}

      <Hint>{t('meals.substitution.autoConvertedHint')}</Hint>

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
              badges={badgesFor(option, active)}
              badgesBelow
              note={
                option.capped
                  ? t('meals.substitution.capShortfall', { basis: basisLabel(active) })
                  : undefined
              }
              selected={picked?.food.id === option.food.id}
              onPress={() => setPicked(option)}
            />
            ))}
          </Rows>
        </Card>
      )}

    </Screen>
  );
}

function badgesFor(option: Exchange, basis: string) {
  const matched = basis === 'protein' ? option.delta.protein_g : option.delta.carb_g;
  const badges: { label: string; tone: 'neutral' | 'primary' | 'good' | 'warm' }[] = [];

  if (basis !== 'kcal') {
    const nutrient = translate(basis === 'protein' ? 'common.labels.protein' : 'common.labels.carbs');
    badges.push(
      Math.abs(matched) < 1
        ? { label: translate('meals.substitution.nutrientSame', { nutrient }), tone: 'primary' }
        : {
            label: translate('meals.substitution.nutrientDifference', {
              amount: Math.abs(Math.round(matched)),
              direction: translate(matched < 0 ? 'meals.substitution.less' : 'meals.substitution.more'),
              nutrient,
            }),
            tone: 'warm',
          },
    );
  }

  const kcal = Math.round(option.delta.kcal);
  badges.push({
    label: kcal === 0
      ? translate('meals.substitution.caloriesSame')
      : translate('meals.substitution.calorieDifference', { amount: `${kcal > 0 ? '+' : ''}${kcal}` }),
    tone: kcal > 0 ? 'warm' : 'good',
  });

  return badges;
}
