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

export default function MealPhotoResults() {
  const { destination = 'today', meal_id } = useLocalSearchParams<{
    destination?: 'meal' | 'today';
    meal_id?: string;
  }>();
  const analysis = photoDraft.get();
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
        <PrimaryButton onPress={() => router.replace('/meals/photo')}>選擇照片</PrimaryButton>
      </Screen>
    );
  }

  const update = (index: number, changes: Partial<ReviewItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  const included = items.filter((item) => !item.skipped && item.selected && item.grams > 0);

  const addToMeal = async () => {
    setBusy(true);
    try {
      const foods = await Promise.all(
        included.map(async (item) => {
          const choices: Food[] = await api.get(`/foods?q=${encodeURIComponent(item.selected!.label)}`);
          return { item, food: choices.find((food) => food.id === item.selected!.food_id) };
        }),
      );
      const missing = foods.find((entry) => !entry.food);
      if (missing) throw new Error(`找不到「${missing.item.selected!.label}」；請改用手動加入食物。`);
      foods.forEach(({ item, food }) => draft.addItem(food!, item.grams));
      photoDraft.clear();
      router.navigate({ pathname: '/meals/[id]', params: { id: meal_id ?? 'new' } });
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
      await Promise.all(
        included.map((item) =>
          api.post(`/days/${date}/meals/extras/items`, {
            food_id: item.selected!.food_id,
            grams: item.grams,
            photo_id: analysis.id,
          }),
        ),
      );
      photoDraft.clear();
      Alert.alert('已記錄', `已將 ${included.length} 項食物記錄到 ${date}。`, [
        { text: '好', onPress: () => router.navigate('/(tabs)/today') },
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
          <PrimaryButton onPress={addToMeal} disabled={busy || included.length === 0}>
            {busy ? '加入中…' : `加入目前餐點 (${included.length})`}
          </PrimaryButton>
        ) : (
          <View className="gap-2">
            <Field label="記錄日期" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            <View className="flex-row">
              <Chip label="今天" selected={date === today()} onPress={() => setDate(today())} />
            </View>
            <PrimaryButton onPress={recordToday} disabled={busy || included.length === 0}>
              {busy ? '記錄中…' : `只記錄這一天 (${included.length})`}
            </PrimaryButton>
          </View>
        )
      }
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={busy}>
        <Text className="text-base text-primary">‹ 重新選照片</Text>
      </Pressable>
      <Title sub="確認食物與份量後再加入。低信心結果建議改選候選食物或略過。">辨識結果</Title>

      {items.length === 0 ? <Hint>沒有辨識到可加入的食物，請改用手動加入。</Hint> : null}
      <Card className="px-4 py-0">
        <Rows>
          {items.map((item, index) => (
            <View key={`${item.label}-${index}`} className={`gap-2 py-3 ${item.skipped ? 'opacity-40' : ''}`}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-ink">{item.selected?.label ?? item.label}</Text>
                  <Confidence confidence={item.confidence} />
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
