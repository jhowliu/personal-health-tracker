import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { CheckIcon, PlusIcon } from '@/components/icons';
import { STEP_LABEL } from '@/components/StepIndicator';
import { BackLink, Card, Chip, Empty, Field, Hint, PrimaryButton, Rows, Screen, Title } from '@/components/ui';
import { ShowMore, usePaged } from '@/components/paging';
import { draft } from '@/meals/draft';
import { newFoodHandoff } from '@/meals/new-food-handoff';
import { byCategoryOrder } from '@/meals/order';
import { amountToGrams, describeFood, gramsToAmount, portionUnit, readableAmount } from '@/meals/portion';
import { photoErrorMessage, pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';
import { photoDraft } from '@/meals/photo-draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Food = Schema<'FoodOut'>;
type Category = Schema<'FoodCategoryOut'>;

const NO_FOODS: Food[] = [];

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
  // Typed in the food's own unit (顆, 匙, g); converted to grams only when it is saved.
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Foods put in on this visit. A meal is several foods, so adding one stays here for the next.
  const [added, setAdded] = useState<string[]>([]);
  const searchVersion = useRef(0);

  const parentRoute =
    destination === 'day'
      ? '/today'
      : ({ pathname: '/meals/[id]', params: { id: meal_id ?? 'new' } } as const);
  const parentLabel = destination === 'day' ? (slot && STEP_LABEL[slot]) || '今天' : '編輯餐點';
  // A snack goes into the day's Extras, outside the three meals, and counts as eaten at once.
  const snack = destination === 'day' && slot === 'extras';
  // Where the food goes, not which category the list is filtered to.
  const heading = snack ? '補記點心' : destination === 'day' && slot && STEP_LABEL[slot] ? `加入${STEP_LABEL[slot]}` : '加入食物';

  useEffect(() => {
    if (destination === 'meal' && (!meal_id || !draft.has(meal_id))) {
      Alert.alert('找不到餐點草稿', '請回到餐點頁重新開啟要編輯的餐點。', [
        { text: '返回餐點', onPress: () => router.replace('/meals') },
      ]);
    }
  }, [destination, meal_id]);

  useEffect(() => {
    api.get('/food-categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const search = useCallback(async () => {
    const version = ++searchVersion.current;
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (filter !== 'all') params.set('category', filter);
      const result = await api.get(`/foods?${params}`);
      if (version === searchVersion.current) setFoods(result);
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
    setAmount(readableAmount(gramsToAmount(food, food.usual_grams)));
  };

  const addFood = async (food: Food, portion: number) => {
    setBusy(true);
    try {
      if (destination === 'day') {
        if (!date || !slot) throw new Error('找不到要加入的日期或餐次。');
        await api.post(
          snack ? `/days/${date}/meals/extras/items` : `/days/${date}/plan/${slot}/items`,
          { food_id: food.id, grams: portion },
        );
      } else {
        if (!meal_id || !draft.has(meal_id)) throw new Error('找不到目前餐點草稿，請重新開啟餐點。');
        draft.addItem(meal_id, food, portion);
      }
      setAdded((current) => [...current, food.name]);
      setPicked(null);
      setAmount('');
    } catch (error) {
      Alert.alert('加入失敗', error instanceof ApiError ? error.message : error instanceof Error ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (picked) void addFood(picked, amountToGrams(picked, Number(amount)) || picked.usual_grams);
  };

  // A food just created from the empty search goes straight in at its usual portion; the
  // portion can be changed once back where 加入食物 was opened from.
  useFocusEffect(
    useCallback(() => {
      const created = newFoodHandoff.take();
      if (created) void addFood(created, created.usual_grams);
      // addFood is rebuilt every render; the handoff is what this effect waits for.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const createFood = () =>
    router.navigate({
      pathname: '/foods/new',
      params: { name: query.trim(), category_id: filter === 'all' ? '' : filter, from: 'add-food' },
    });

  const addFromPhoto = async () => {
    if (destination === 'day' && (!date || !slot)) {
      Alert.alert('找不到餐次', '請回到今日流程重新選擇早餐、午餐或晚餐。');
      return;
    }
    setPhotoBusy(true);
    try {
      const analysis = await pickAndAnalyzeMealPhoto();
      if (!analysis) return;
      photoDraft.set(analysis);
      router.navigate({
        pathname: '/meals/photo-results',
        // A photographed snack is recorded for the day as it is, like 只記錄這一天.
        params: snack
          ? { destination: 'today', date, analysis_id: analysis.id }
          : {
              destination,
              meal_id,
              date,
              slot,
              analysis_id: analysis.id,
            },
      });
    } catch (error) {
      Alert.alert('無法辨識餐點', photoErrorMessage(error));
    } finally {
      setPhotoBusy(false);
    }
  };

  const unit = portionUnit(picked);
  const pickedGrams = picked ? amountToGrams(picked, Number(amount) || 0) : 0;
  const kcal = picked ? Math.round((picked.per_100g.kcal * pickedGrams) / 100) : 0;
  const ordered = useMemo(() => foods && byCategoryOrder(foods, categories), [foods, categories]);
  const { visible, remaining, showMore } = usePaged(ordered ?? NO_FOODS, ordered);

  return (
    <Screen
      footer={
        picked ? (
          <>
            <View className="flex-row items-end gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm text-muted">已選擇</Text>
                <Text className="text-base font-semibold text-ink" numberOfLines={1}>
                  {picked.name}
                </Text>
              </View>
              <Text className="font-display text-2xl font-bold text-ink">{kcal} 大卡</Text>
            </View>
            <Field
              label="份量"
              value={amount}
              onChangeText={setAmount}
              suffix={unit.label}
              keyboardType="decimal-pad"
            />
            {unit.gramsPerUnit === 1 || !pickedGrams ? null : <Hint>約 {readableAmount(pickedGrams)} g</Hint>}
            <PrimaryButton onPress={add} disabled={!Number(amount) || photoBusy} busy={busy}>
              {busy ? '加入中…' : snack ? '記下這份點心' : `加入${picked.name}`}
            </PrimaryButton>
          </>
        ) : added.length ? (
          <>
            <View className="flex-row items-center gap-2">
              <CheckIcon size={18} tint={color.good} />
              <Text className="flex-1 text-base text-ink" numberOfLines={2}>
                已加入 {added.length} 項：{added.join('、')}
              </Text>
            </View>
            <PrimaryButton onPress={() => backOrReplace(parentRoute)} disabled={photoBusy}>
              {`完成，回到${parentLabel}`}
            </PrimaryButton>
          </>
        ) : undefined
      }
    >
      <BackLink
        label={parentLabel}
        onPress={() => backOrReplace(parentRoute)}
        disabled={busy || photoBusy}
      />

      <Title sub={snack ? '三餐以外吃的，記下就算吃了。' : undefined}>{heading}</Title>

      <PrimaryButton tone="plain" onPress={addFromPhoto} disabled={busy} busy={photoBusy}>
        {photoBusy ? '辨識中…' : '用照片辨識多個食物'}
      </PrimaryButton>
      <Hint>可拍照或從相簿選擇，確認辨識結果後才會加入。</Hint>

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

      {ordered === null ? (
        <ActivityIndicator color={color.primary} />
      ) : ordered.length === 0 ? (
        <Empty
          compact
          action={
            <PrimaryButton tone="plain" icon={PlusIcon} onPress={createFood} disabled={busy}>
              {query.trim() ? `新增「${query.trim()}」到食物庫` : '新增食物到食物庫'}
            </PrimaryButton>
          }
        >
          食物庫裡找不到{query.trim() ? `「${query.trim()}」` : '符合的食物'}。新增後會直接加進來。
        </Empty>
      ) : (
        <Card className="px-0 py-0">
          <Rows>
            {visible.map((food) => (
            <FoodOptionRow
              key={food.id}
              name={food.name}
              detail={describeFood(food)}
              badges={[{ label: categories.find((c) => c.id === food.category_id)?.name ?? '', tone: 'primary' }]}
              selected={picked?.id === food.id}
              onPress={() => choose(food)}
            />
            ))}
          </Rows>
        </Card>
      )}

      <ShowMore remaining={remaining} onPress={showMore} />

    </Screen>
  );
}

