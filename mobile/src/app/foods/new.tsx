import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { backOrReplace } from '@/navigation/back';
import { newFoodHandoff } from '@/meals/new-food-handoff';
import { pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';

type Category = Schema<'FoodCategoryOut'>;
type Food = Schema<'FoodOut'>;

const number = (value: string) => Number(value) || 0;
const calories = (protein: string, carbs: string, fat: string) =>
  number(protein) * 4 + number(carbs) * 4 + number(fat) * 9;

export default function NewFoodScreen() {
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
        Alert.alert('讀不到食物分類', error instanceof ApiError ? error.message : '請稍後再試。'),
      );
  }, []);

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
      Alert.alert('讀不到食物', error instanceof ApiError ? error.message : '請稍後再試。', [
        { text: '返回食物庫', onPress: () => backOrReplace('/meals') },
      ]),
    );
    return () => { live = false; };
  }, [id, isNew]);

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
      if (!item) throw new Error('照片中沒有辨識到食物。');

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
        '照片帶入失敗',
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : '請稍後再試。',
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const grams = number(usualGrams);
    const max = maxGrams ? number(maxGrams) : grams * 2;
    if (!name.trim() || !categoryId || grams <= 0 || max < grams || (unit !== 'g' && number(gramsPerUnit) <= 0)) {
      Alert.alert('資料不完整', '請填寫名稱、分類、有效份量與每單位公克數。');
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
      Alert.alert('儲存失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  const remove = () => Alert.alert('移除食物', `從食物庫移除「${name}」？既有餐點仍可使用。`, [
    { text: '取消', style: 'cancel' },
    { text: '移除', style: 'destructive', onPress: async () => {
      setBusy(true);
      try {
        await api.delete(`/foods/${id}`);
        backOrReplace('/meals');
      } catch (error) {
        Alert.alert('移除失敗', error instanceof ApiError ? error.message : '請稍後再試。');
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
            <Text className="text-sm text-muted">每 100 g</Text>
            <Text className="text-2xl text-ink">約 {kcal} 大卡</Text>
          </View>
          <PrimaryButton onPress={save} busy={busy}>
            {busy ? '處理中…' : fromSearch ? '新增並加入' : isNew ? '新增食物' : '儲存食物'}
          </PrimaryButton>
        </>
      }
    >
      <BackLink
        label={fromSearch ? '加入食物' : '食物庫'}
        onPress={() => (fromSearch ? router.back() : backOrReplace('/meals'))}
        disabled={busy}
      />
      <Title sub="營養以每 100 g 計；編輯後會更新既有餐點，已吃紀錄保留原值。">
        {isNew ? '新增食物' : '編輯食物'}
      </Title>

      <PrimaryButton tone="plain" onPress={fillFromPhoto} disabled={busy}>
        {busy ? '辨識中…' : '從照片帶入'}
      </PrimaryButton>

      <Card className="gap-3">
        <Field label="食物名稱" value={name} onChangeText={setName} placeholder="例如：火龍果" />
        <View className="gap-1">
          <Hint>狀態</Hint>
          <View className="flex-row gap-2">
            {([['na', '未指定'], ['raw', '生'], ['cooked', '熟']] as const).map(([value, label]) => (
              <Chip key={value} label={label} selected={state === value} onPress={() => setState(value)} />
            ))}
          </View>
        </View>
        <View className="gap-1">
          <Hint>分類</Hint>
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
        <Text className="text-base text-ink">份量</Text>
        <View className="flex-row flex-wrap gap-2">
          {([['g', 'g'], ['ml', 'ml'], ['piece', '顆'], ['scoop', '匙'], ['bowl', '碗']] as const).map(([value, label]) => (
            <Chip key={value} label={label} selected={unit === value} onPress={() => setUnit(value)} />
          ))}
        </View>
        {unit !== 'g' ? (
          <Field label="每單位公克數" value={gramsPerUnit} onChangeText={setGramsPerUnit} suffix="g" keyboardType="decimal-pad" />
        ) : null}
        <View className="flex-row gap-3">
          <Field label="常用份量" value={usualGrams} onChangeText={setUsualGrams} suffix="g" keyboardType="decimal-pad" />
          <Field label="最大份量" value={maxGrams} onChangeText={setMaxGrams} suffix="g" keyboardType="decimal-pad" placeholder="常用份量的兩倍" />
        </View>
        {fromSearch ? <Hint>新增後會用常用份量加入，之後可以再調整。</Hint> : null}
      </Card>

      <Card className="gap-3">
        <Text className="text-base text-ink">每 100 g 營養</Text>
        <Field label="熱量" value={kcalValue} onChangeText={setKcalValue} suffix="kcal" keyboardType="decimal-pad" />
        <View className="flex-row gap-3">
          <Field label="蛋白質" value={protein} onChangeText={(value) => changeMacro('protein', value)} suffix="g" keyboardType="decimal-pad" />
          <Field label="碳水" value={carbs} onChangeText={(value) => changeMacro('carbs', value)} suffix="g" keyboardType="decimal-pad" />
        </View>
        <View className="flex-row gap-3">
          <Field label="脂肪" value={fat} onChangeText={(value) => changeMacro('fat', value)} suffix="g" keyboardType="decimal-pad" />
          <Field label="纖維（選填）" value={fiber} onChangeText={setFiber} suffix="g" keyboardType="decimal-pad" />
        </View>
        <Hint>修改三大營養素時會重算熱量，也可自行調整熱量。</Hint>
      </Card>

      {isNew ? null : (
        <PrimaryButton tone="danger" onPress={remove} disabled={busy}>移除這項食物</PrimaryButton>
      )}
    </Screen>
  );
}
