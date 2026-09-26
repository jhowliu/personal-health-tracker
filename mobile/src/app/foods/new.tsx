import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { backOrReplace } from '@/navigation/back';
import { pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';

type Category = Schema<'FoodCategoryOut'>;
type Food = Schema<'FoodOut'>;

const number = (value: string) => Number(value) || 0;
const calories = (protein: string, carbs: string, fat: string) =>
  number(protein) * 4 + number(carbs) * 4 + number(fat) * 9;

export default function NewFoodScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [usualGrams, setUsualGrams] = useState('100');
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
        setProtein(String(item.estimate.protein_per_100g));
        setCarbs(String(item.estimate.carb_per_100g));
        setFat(String(item.estimate.fat_per_100g));
      } else if (item.food_id) {
        const foods: Food[] = await api.get(`/foods?q=${encodeURIComponent(item.label)}`);
        const matched = foods.find((food) => food.id === item.food_id);
        if (matched) {
          setCategoryId(matched.category_id);
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
    if (!name.trim() || !categoryId || grams <= 0) {
      Alert.alert('資料不完整', '請填寫食物名稱、分類與大於 0 的常用份量。');
      return;
    }
    setBusy(true);
    try {
      await api.post('/foods', {
        category_id: categoryId,
        name: name.trim(),
        state: 'na',
        kcal_per_100g: calories(protein, carbs, fat),
        protein_per_100g: number(protein),
        fat_per_100g: number(fat),
        carb_per_100g: number(carbs),
        unit: 'g',
        grams_per_unit: null,
        usual_grams: grams,
        max_grams: grams * 2,
      });
      Alert.alert('已新增食物', name.trim(), [{ text: '好', onPress: () => backOrReplace('/meals') }]);
    } catch (error) {
      Alert.alert('新增失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  const kcal = Math.round(calories(protein, carbs, fat));
  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">每 100g</Text>
            <Text className="font-display text-2xl font-bold text-ink">約 {kcal} 大卡</Text>
          </View>
          <PrimaryButton onPress={save} busy={busy}>
            {busy ? '處理中…' : '新增食物'}
          </PrimaryButton>
        </>
      }
    >
      <Pressable accessibilityRole="button" onPress={() => backOrReplace('/meals')} disabled={busy}>
        <Text className="text-base text-primary">‹ 返回食物庫</Text>
      </Pressable>
      <Title sub="輸入每 100g 的三大營養素，也可以先用照片帶入再調整。">新增自訂食物</Title>

      <PrimaryButton tone="plain" onPress={fillFromPhoto} disabled={busy}>
        {busy ? '辨識中…' : '從照片帶入'}
      </PrimaryButton>

      <Card className="gap-3">
        <Field label="食物名稱" value={name} onChangeText={setName} placeholder="例如：火龍果" />
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
        <Text className="text-base font-semibold text-ink">每 100g 營養</Text>
        <View className="flex-row gap-3">
          <Field label="Protein" value={protein} onChangeText={setProtein} suffix="g" keyboardType="decimal-pad" />
          <Field label="Carbs" value={carbs} onChangeText={setCarbs} suffix="g" keyboardType="decimal-pad" />
        </View>
        <View className="flex-row gap-3">
          <Field label="Fats" value={fat} onChangeText={setFat} suffix="g" keyboardType="decimal-pad" />
          <Field label="常用份量" value={usualGrams} onChangeText={setUsualGrams} suffix="g" keyboardType="decimal-pad" />
        </View>
        <Hint>依三大營養素計算：約 {kcal} kcal / 100g</Hint>
      </Card>
    </Screen>
  );
}
