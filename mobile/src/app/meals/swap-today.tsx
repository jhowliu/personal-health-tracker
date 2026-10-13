/**
 * Swapping one food on *today's plate*.
 *
 * Sibling of substitute.tsx, which edits a meal template. This one writes straight to
 * the day's plan, so the change lands on today only and leaves the recipe alone.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Text } from '@/components/text';
import { BackLink, Card, Hint, PrimaryButton, Rows, Screen, Segmented, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Exchange = Schema<'ExchangeOut'>;
type Category = Schema<'FoodCategoryOut'>;

const basisLabel = (basis: string) => translate(
  basis === 'carb'
    ? 'meals.substitution.equalCarbs'
    : basis === 'protein'
      ? 'meals.substitution.equalProtein'
      : 'meals.substitution.equalCalories',
);

export default function SwapToday() {
  const { t } = useI18n();
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
  const loadVersion = useRef(0);

  useEffect(() => {
    if (!params.date || !params.slot || !params.item || !params.food || !params.grams) {
      Alert.alert(t('meals.substitution.missingTodayTitle'), t('meals.substitution.missingTodayBody'), [
        { text: t('meals.photo.returnToToday'), onPress: () => router.replace('/today') },
      ]);
    }
  }, [params.date, params.food, params.grams, params.item, params.slot, t]);

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
    if (!params.food || !params.grams) return;
    const version = ++loadVersion.current;
    setOptions(null);
    setPicked(null);
    try {
      const chosen = basis ?? defaultBasis;
      const result = await api.get(
        `/foods/${params.food}/exchanges?grams=${params.grams}&match=${chosen}`,
      );
      if (version === loadVersion.current) setOptions(result);
    } catch (error) {
      Alert.alert(t('meals.substitution.loadOptionsFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    }
  }, [params.food, params.grams, basis, defaultBasis, t]);

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
      backOrReplace('/today');
    } catch (error) {
      Alert.alert(t('meals.substitution.replaceFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    } finally {
      setBusy(false);
    }
  };

  const active = basis ?? defaultBasis;
  const choices = defaultBasis === 'kcal' ? [] : [defaultBasis, 'kcal'];

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
            <PrimaryButton onPress={confirm} busy={busy}>
              {busy ? t('common.states.processing') : t('meals.substitution.replaceThis')}
            </PrimaryButton>
          </>
        ) : undefined
      }
    >
      <BackLink label={t('common.labels.today')} onPress={() => backOrReplace('/today')} disabled={busy} />

      <Title sub={t('meals.substitution.oneDayOnly', { day: params.date ? dayWord(params.date) : t('common.labels.today') })}>
        {t('meals.substitution.titleToday')}
      </Title>

      {choices.length ? (
        <View className="gap-1">
          <Text className="text-sm text-muted">{t('meals.substitution.conversionMethod')}</Text>
          <Segmented
            value={active}
            onChange={setBasis}
            options={choices.map((b) => ({ value: b, label: basisLabel(b) }))}
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
              badges={[
                {
                  label:
                    Math.round(option.delta.kcal) === 0
                      ? t('meals.substitution.caloriesSame')
                      : t('meals.substitution.calorieDifference', {
                          amount: `${option.delta.kcal > 0 ? '+' : ''}${Math.round(option.delta.kcal)}`,
                        }),
                  tone: option.delta.kcal > 0 ? 'warm' : 'good',
                },
              ]}
              badgesBelow
              note={option.capped ? t('meals.substitution.capped') : undefined}
              selected={picked?.food.id === option.food.id}
              onPress={() => setPicked(option)}
            />
            ))}
          </Rows>
        </Card>
      )}

      {categories.length === 0 ? null : (
        <Hint>{t('meals.substitution.permanentHint')}</Hint>
      )}
    </Screen>
  );
}
