import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Card, Chip, Field, Hint, PrimaryButton, Rows, Screen, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { photoDraft, type RecognizedFood, type RecognizedItem } from '@/meals/photo-draft';

type Food = Schema<'FoodOut'>;
type ReviewItem = RecognizedItem & { skipped: boolean; selected: RecognizedFood | null };

const today = () => new Date().toLocaleDateString('en-CA');
const kcalFromMacros = (protein: number, carbs: number, fat: number) =>
  protein * 4 + carbs * 4 + fat * 9;

export default function MealPhotoResults() {
  const { destination = 'today', meal_id, analysis_id: analysisId } = useLocalSearchParams<{
    destination?: 'meal' | 'today';
    meal_id?: string;
    analysis_id?: string;
  }>();
  const analysis = photoDraft.get(analysisId);
  const [items, setItems] = useState<ReviewItem[]>(() =>
    (analysis?.items ?? []).map((item) => ({
      ...item,
      skipped: false,
      selected: item.food_id
        ? item.alternatives.find((option) => option.food_id === item.food_id) ?? {
            food_id: item.food_id,
            category_id: item.category_id ?? '',
            label: item.label,
          }
        : null,
    })),
  );
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  if (!analysis) {
    return (
      <Screen>
        <Title>找不到辨識結果</Title>
        <Hint>請先選擇餐點照片再進行辨識。</Hint>
        <PrimaryButton
          onPress={() =>
            router.replace({ pathname: '/meals/photo', params: { destination, meal_id } })
          }
        >
          選擇照片
        </PrimaryButton>
      </Screen>
    );
  }

  const update = (index: number, changes: Partial<ReviewItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  const updateEstimate = (
    index: number,
    field: 'protein_per_100g' | 'carb_per_100g' | 'fat_per_100g',
    value: string,
  ) =>
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index || !item.estimate) return item;
        const estimate = { ...item.estimate, [field]: Number(value) || 0 };
        estimate.kcal_per_100g = kcalFromMacros(
          estimate.protein_per_100g,
          estimate.carb_per_100g,
          estimate.fat_per_100g,
        );
        return { ...item, estimate };
      }),
    );
  const included = items.filter(
    (item) => !item.skipped && (item.selected || item.estimate) && item.grams > 0,
  );

  const resolveIncludedFoods = async () => {
    const resolved: { item: ReviewItem; food: Food }[] = [];
    for (const [index, item] of items.entries()) {
      if (item.skipped || item.grams <= 0 || (!item.selected && !item.estimate)) continue;

      const label = item.selected?.label ?? item.label;
      const choices: Food[] = await api.get(`/foods?q=${encodeURIComponent(label)}`);
      let food = item.selected
        ? choices.find((candidate) => candidate.id === item.selected!.food_id)
        : choices.find(
            (candidate) =>
              candidate.name.trim().toLocaleLowerCase() === item.label.trim().toLocaleLowerCase(),
          );

      if (!food && item.estimate) {
        food = await api.post('/foods', {
          category_id: item.estimate.category_id,
          name: item.label,
          state: 'na',
          kcal_per_100g: item.estimate.kcal_per_100g,
          protein_per_100g: item.estimate.protein_per_100g,
          fat_per_100g: item.estimate.fat_per_100g,
          carb_per_100g: item.estimate.carb_per_100g,
          unit: 'g',
          grams_per_unit: null,
          usual_grams: item.grams,
          max_grams: item.grams * 2,
        });
        const selected = {
          food_id: food.id,
          category_id: food.category_id,
          label: food.name,
        };
        update(index, { selected, alternatives: [selected, ...item.alternatives] });
      }
      if (!food) throw new Error(`找不到「${label}」；請改用手動加入食物。`);
      resolved.push({ item, food });
    }
    return resolved;
  };

  const addToMeal = async () => {
    if (!meal_id || !draft.has(meal_id)) {
      Alert.alert('找不到餐點草稿', '請回到餐點頁重新開啟要編輯的餐點。');
      return;
    }
    setBusy(true);
    try {
      const foods = await resolveIncludedFoods();
      foods.forEach(({ item, food }) => draft.addItem(meal_id, food, item.grams));
      photoDraft.clear(analysisId);
      router.dismissTo({ pathname: '/meals/[id]', params: { id: meal_id } });
    } catch (error) {
      Alert.alert('加入餐點失敗', error instanceof ApiError ? error.message : error instanceof Error ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  const recordToday = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('日期格式不正確', '請輸入 YYYY-MM-DD，例如 2026-09-23。');
      return;
    }
    setBusy(true);
    try {
      const foods = await resolveIncludedFoods();
      await Promise.all(
        foods.map(({ item, food }) =>
          api.post(`/days/${date}/meals/extras/items`, {
            food_id: food.id,
            grams: item.grams,
            photo_id: analysis.id,
          }),
        ),
      );
      photoDraft.clear(analysisId);
      Alert.alert('已記錄', `已將 ${included.length} 項食物記錄到 ${date}。`, [
        { text: '好', onPress: () => router.dismissTo('/today') },
      ]);
    } catch (error) {
      Alert.alert('記錄失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        destination === 'meal' ? (
          <PrimaryButton onPress={addToMeal} disabled={included.length === 0} busy={busy}>
            {busy ? '加入中…' : `加入目前餐點 (${included.length})`}
          </PrimaryButton>
        ) : (
          <View className="gap-2">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm text-muted">{date}</Text>
              <Text className="text-sm text-muted">已選 {included.length} 項</Text>
            </View>
            <PrimaryButton onPress={recordToday} disabled={included.length === 0} busy={busy}>
              {busy ? '記錄中…' : `只記錄這一天 (${included.length})`}
            </PrimaryButton>
          </View>
        )
      }
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          photoDraft.clear(analysisId);
          router.replace({ pathname: '/meals/photo', params: { destination, meal_id } });
        }}
        disabled={busy}
      >
        <Text className="text-base text-primary">‹ 重新選照片</Text>
      </Pressable>
      <Title sub="確認食物與份量後再加入。低信心結果建議改選候選食物或略過。">辨識結果</Title>

      {destination === 'today' ? (
        <View className="gap-2">
          <Field label="記錄日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
          <View className="flex-row">
            <Chip label="今天" selected={date === today()} onPress={() => setDate(today())} />
          </View>
        </View>
      ) : null}

      {items.length === 0 ? <Hint>沒有辨識到可加入的食物，請改用手動加入。</Hint> : null}
      <Card className="px-4 py-0">
        <Rows>
          {items.map((item, index) => (
            <View key={`${item.label}-${index}`} className={`gap-2 py-3 ${item.skipped ? 'opacity-40' : ''}`}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-ink">{item.selected?.label ?? item.label}</Text>
                  <Confidence confidence={item.recognition_confidence} />
                </View>
                <Pressable accessibilityRole="button" onPress={() => update(index, { skipped: !item.skipped })}>
                  <Text className="text-base text-primary">{item.skipped ? '恢復' : '略過'}</Text>
                </Pressable>
              </View>
              <Field
                label="估計份量"
                value={String(Math.round(item.grams))}
                onChangeText={(text) => update(index, { grams: Number(text) || 0 })}
                suffix="g"
                keyboardType="decimal-pad"
                editable={!item.skipped}
              />
              {item.alternatives.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {item.alternatives.map((option) => (
                    <Chip
                      key={option.food_id}
                      label={option.label}
                      selected={item.selected?.food_id === option.food_id}
                      onPress={() => update(index, { selected: option, skipped: false })}
                    />
                  ))}
                </View>
              ) : item.estimate ? (
                <View className="gap-3 rounded-card bg-fill p-3">
                  <Hint>本機食物庫沒有匹配；確認記錄時會以 AI 估算新增。</Hint>
                  <Field
                    label="食物名稱"
                    value={item.label}
                    onChangeText={(label) => update(index, { label })}
                    editable={!item.skipped}
                  />
                  <View className="flex-row gap-2">
                    <Field
                      label="Protein"
                      value={String(item.estimate.protein_per_100g)}
                      onChangeText={(value) => updateEstimate(index, 'protein_per_100g', value)}
                      suffix="g"
                      keyboardType="decimal-pad"
                      editable={!item.skipped}
                    />
                    <Field
                      label="Carbs"
                      value={String(item.estimate.carb_per_100g)}
                      onChangeText={(value) => updateEstimate(index, 'carb_per_100g', value)}
                      suffix="g"
                      keyboardType="decimal-pad"
                      editable={!item.skipped}
                    />
                  </View>
                  <Field
                    label="Fats"
                    value={String(item.estimate.fat_per_100g)}
                    onChangeText={(value) => updateEstimate(index, 'fat_per_100g', value)}
                    suffix="g"
                    keyboardType="decimal-pad"
                    editable={!item.skipped}
                  />
                  <Hint>約 {Math.round(item.estimate.kcal_per_100g)} kcal / 100g</Hint>
                </View>
              ) : item.selected ? null : (
                <Hint>此項沒有可對應的食物，請略過後手動加入。</Hint>
              )}
            </View>
          ))}
        </Rows>
      </Card>
      <Hint>「只記錄這一天」會新增每日額外食物，不會建立或覆寫命名餐點。</Hint>
    </Screen>
  );
}

function Confidence({ confidence }: { confidence: number }) {
  const state = confidence >= 0.8 ? ['信心高', 'good'] : confidence >= 0.5 ? ['需確認', 'warm'] : ['信心低', 'neutral'];
  return <Chip label={`${state[0]} ${Math.round(confidence * 100)}%`} tone={state[1] as 'good' | 'warm' | 'neutral'} />;
}
