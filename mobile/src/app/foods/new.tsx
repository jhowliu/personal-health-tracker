import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { newFoodHandoff } from '@/meals/new-food-handoff';
import { pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';

type Category = Schema<'FoodCategoryOut'>;
type Food = Schema<'FoodOut'>;

const number = (value: string) => Number(value) || 0;
const calories = (protein: string, carbs: string, fat: string) =>
  number(protein) * 4 + number(carbs) * 4 + number(fat) * 9;

export default function NewFoodScreen() {
  const { t } = useI18n();
  const { id, name: typedName, category_id: typedCategory, from } = useLocalSearchParams<{
    id?: string;
    /** Opened from 加入食物's empty search: what was typed there, and the category in view. */
    name?: string;
    category_id?: string;
    from?: 'add-food';
  }>();
  const isNew = !id || id === 'new';
  const fromSearch = isNew && from === 'add-food';
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(typedName ?? '');
  const [categoryId, setCategoryId] = useState(typedCategory ?? '');
  const [state, setState] = useState<'raw' | 'cooked' | 'na'>('na');
  const [unit, setUnit] = useState<'g' | 'ml' | 'piece' | 'scoop' | 'bowl'>('g');
  const [gramsPerUnit, setGramsPerUnit] = useState('');
  const [kcalValue, setKcalValue] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [usualGrams, setUsualGrams] = useState('100');
  const [maxGrams, setMaxGrams] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/food-categories')
      .then((items: Category[]) => {
        setCategories(items);
        setCategoryId((current) => current || items[0]?.id || '');
      })
      .catch((error) =>
        Alert.alert(t('meals.foodEditor.loadCategoriesFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain')),
      );
  }, [t]);

  useEffect(() => {
    if (isNew) return;
    let live = true;
    api.get(`/foods/${id}`).then((food: Food) => {
      if (!live) return;
      setName(food.name);
      setCategoryId(food.category_id);
      setState(food.state as 'raw' | 'cooked' | 'na');
      setUnit(food.unit as 'g' | 'ml' | 'piece' | 'scoop' | 'bowl');
      setGramsPerUnit(food.grams_per_unit === null ? '' : String(food.grams_per_unit));
      setKcalValue(String(food.per_100g.kcal));
      setProtein(String(food.per_100g.protein_g));
      setCarbs(String(food.per_100g.carb_g));
      setFat(String(food.per_100g.fat_g));
      setFiber(food.fiber_per_100g === null ? '' : String(food.fiber_per_100g));
      setUsualGrams(String(food.usual_grams));
      setMaxGrams(String(food.max_grams));
      setLoadedId(id);
    }).catch((error) =>
      Alert.alert(t('meals.foodEditor.loadFoodFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'), [
        { text: t('meals.foodEditor.returnToLibrary'), onPress: () => backOrReplace('/meals') },
      ]),
    );
    return () => { live = false; };
  }, [id, isNew, t]);

  const changeMacro = (which: 'protein' | 'carbs' | 'fat', value: string) => {
    const next = { protein, carbs, fat, [which]: value };
    if (which === 'protein') setProtein(value);
    if (which === 'carbs') setCarbs(value);
    if (which === 'fat') setFat(value);
    setKcalValue(String(Math.round(calories(next.protein, next.carbs, next.fat) * 10) / 10));
  };

  const fillFromPhoto = async () => {
    setBusy(true);
    try {
      const analysis = await pickAndAnalyzeMealPhoto();
      if (!analysis) return;
      const item = analysis.items[0];
      if (!item) throw new Error(t('meals.foodEditor.photoMissingFood'));

      setName(item.label);
      setUsualGrams(String(Math.round(item.grams)));
      if (item.estimate) {
        setCategoryId(item.estimate.category_id);
        setKcalValue(String(item.estimate.kcal_per_100g));
        setProtein(String(item.estimate.protein_per_100g));
        setCarbs(String(item.estimate.carb_per_100g));
        setFat(String(item.estimate.fat_per_100g));
      } else if (item.food_id) {
        const foods: Food[] = await api.get(`/foods?q=${encodeURIComponent(item.label)}`);
        const matched = foods.find((food) => food.id === item.food_id);
        if (matched) {
          setCategoryId(matched.category_id);
          setKcalValue(String(matched.per_100g.kcal));
          setProtein(String(matched.per_100g.protein_g));
          setCarbs(String(matched.per_100g.carb_g));
          setFat(String(matched.per_100g.fat_g));
        }
      }
    } catch (error) {
      Alert.alert(
        t('meals.foodEditor.photoImportFailed'),
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : t('common.errors.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const grams = number(usualGrams);
    const max = maxGrams ? number(maxGrams) : grams * 2;
    if (!name.trim() || !categoryId || grams <= 0 || max < grams || (unit !== 'g' && number(gramsPerUnit) <= 0)) {
      Alert.alert(t('common.errors.incompleteData'), t('meals.foodEditor.incompleteBody'));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        category_id: categoryId,
        name: name.trim(),
        state,
        kcal_per_100g: number(kcalValue),
        protein_per_100g: number(protein),
        fat_per_100g: number(fat),
        carb_per_100g: number(carbs),
        fiber_per_100g: fiber ? number(fiber) : null,
        unit,
        grams_per_unit: unit === 'g' ? null : number(gramsPerUnit),
        usual_grams: grams,
        max_grams: max,
      };
      if (fromSearch) {
        // Back to 加入食物, which adds it to the meal and returns to the flow.
        newFoodHandoff.set(await api.post('/foods', payload));
        router.back();
        return;
      }
      if (isNew) await api.post('/foods', payload);
      else await api.patch(`/foods/${id}`, payload);
      backOrReplace('/meals');
    } catch (error) {
      Alert.alert(t('common.errors.saveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => Alert.alert(t('meals.foodEditor.removeTitle'), t('meals.foodEditor.removeBody', { name }), [
    { text: t('common.actions.cancel'), style: 'cancel' },
    { text: t('common.actions.remove'), style: 'destructive', onPress: async () => {
      setBusy(true);
      try {
        await api.delete(`/foods/${id}`);
        backOrReplace('/meals');
      } catch (error) {
        Alert.alert(t('common.errors.removeFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
      } finally { setBusy(false); }
    } },
  ]);

  if (!isNew && loadedId !== id) {
    return <Screen scroll={false}><View className="flex-1 items-center justify-center"><ActivityIndicator /></View></Screen>;
  }

  const kcal = Math.round(number(kcalValue));
  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">{t('meals.foodEditor.perHundredGrams')}</Text>
            <Text className="text-2xl text-ink">{t('meals.foodEditor.approximateCalories', { calories: kcal })}</Text>
          </View>
          <PrimaryButton onPress={save} busy={busy}>
            {busy
              ? t('common.states.processing')
              : fromSearch
                ? t('meals.foodEditor.createAndAdd')
                : isNew
                  ? t('meals.foodEditor.createFood')
                  : t('meals.foodEditor.saveFood')}
          </PrimaryButton>
        </>
      }
    >
      <BackLink
        label={fromSearch ? t('meals.foodEditor.addFood') : t('meals.home.foodLibrary')}
        onPress={() => (fromSearch ? router.back() : backOrReplace('/meals'))}
        disabled={busy}
      />
      <Title sub={t('meals.foodEditor.nutritionEditHint')}>
        {isNew ? t('meals.foodEditor.titleNew') : t('meals.foodEditor.titleEdit')}
      </Title>

      <PrimaryButton tone="plain" onPress={fillFromPhoto} disabled={busy}>
        {busy ? t('common.states.recognizing') : t('meals.foodEditor.importFromPhoto')}
      </PrimaryButton>

      <Card className="gap-3">
        <Field label={t('meals.foodEditor.foodName')} value={name} onChangeText={setName} placeholder={t('meals.foodEditor.foodNamePlaceholder')} />
        <View className="gap-1">
          <Hint>{t('common.labels.status')}</Hint>
          <View className="flex-row gap-2">
            {([['na', 'meals.foodEditor.stateUnspecified'], ['raw', 'meals.foodEditor.stateRaw'], ['cooked', 'meals.foodEditor.stateCooked']] as const).map(([value, labelKey]) => (
              <Chip key={value} label={t(labelKey)} selected={state === value} onPress={() => setState(value)} />
            ))}
          </View>
        </View>
        <View className="gap-1">
          <Hint>{t('common.labels.category')}</Hint>
          <View className="flex-row flex-wrap gap-2">
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                selected={categoryId === category.id}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
        </View>
      </Card>

      <Card className="gap-3">
        <Text className="text-base text-ink">{t('common.labels.portion')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {([['g', 'g'], ['ml', 'ml'], ['piece', 'common.units.piece'], ['scoop', 'common.units.scoop'], ['bowl', 'common.units.bowl']] as const).map(([value, label]) => (
            <Chip key={value} label={label.includes('.') ? t(label as 'common.units.piece') : label} selected={unit === value} onPress={() => setUnit(value)} />
          ))}
        </View>
        {unit !== 'g' ? (
          <Field label={t('meals.foodEditor.gramsPerUnit')} value={gramsPerUnit} onChangeText={setGramsPerUnit} suffix="g" keyboardType="decimal-pad" />
        ) : null}
        <View className="flex-row gap-3">
          <Field label={t('meals.foodEditor.usualPortion')} value={usualGrams} onChangeText={setUsualGrams} suffix="g" keyboardType="decimal-pad" />
          <Field label={t('meals.foodEditor.maximumPortion')} value={maxGrams} onChangeText={setMaxGrams} suffix="g" keyboardType="decimal-pad" placeholder={t('meals.foodEditor.maximumPlaceholder')} />
        </View>
        {fromSearch ? <Hint>{t('meals.foodEditor.createFromSearchHint')}</Hint> : null}
      </Card>

      <Card className="gap-3">
        <Text className="text-base text-ink">{t('meals.foodEditor.nutritionPerHundred')}</Text>
        <Field label={t('common.labels.calories')} value={kcalValue} onChangeText={setKcalValue} suffix="kcal" keyboardType="decimal-pad" />
        <View className="flex-row gap-3">
          <Field label={t('common.labels.protein')} value={protein} onChangeText={(value) => changeMacro('protein', value)} suffix="g" keyboardType="decimal-pad" />
          <Field label={t('common.labels.carbs')} value={carbs} onChangeText={(value) => changeMacro('carbs', value)} suffix="g" keyboardType="decimal-pad" />
        </View>
        <View className="flex-row gap-3">
          <Field label={t('common.labels.fat')} value={fat} onChangeText={(value) => changeMacro('fat', value)} suffix="g" keyboardType="decimal-pad" />
          <Field label={t('meals.foodEditor.fiberOptional')} value={fiber} onChangeText={setFiber} suffix="g" keyboardType="decimal-pad" />
        </View>
        <Hint>{t('meals.foodEditor.macroRecalculationHint')}</Hint>
      </Card>

      {isNew ? null : (
        <PrimaryButton tone="danger" onPress={remove} disabled={busy}>{t('meals.foodEditor.removeThisFood')}</PrimaryButton>
      )}
    </Screen>
  );
}
