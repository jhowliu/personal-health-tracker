import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { FoodOptionRow } from '@/components/FoodOptionRow';
import { Sheet } from '@/components/Sheet';
import { BackLink, Card, Chip, Field, Hint, PrimaryButton, Rows, Screen, TextAction, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { photoDraft, type RecognizedFood, type RecognizedItem } from '@/meals/photo-draft';
import { describeFood } from '@/meals/portion';
import { color } from '@/theme/tokens';

type Food = Schema<'FoodOut'>;
type ReviewItem = RecognizedItem & {
  skipped: boolean;
  selected: RecognizedFood | null;
  /** The user picked this food themselves, so the model's confidence no longer applies. */
  confirmed: boolean;
};
type MacroField = 'protein_per_100g' | 'carb_per_100g' | 'fat_per_100g';

const today = () => new Date().toLocaleDateString('en-CA');
const kcalFromMacros = (protein: number, carbs: number, fat: number) =>
  protein * 4 + carbs * 4 + fat * 9;
const SLOT_LABEL: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
const libraryPick = (food: Food): RecognizedFood => ({
  food_id: food.id,
  category_id: food.category_id,
  label: food.name,
});

export default function MealPhotoResults() {
  const {
    destination = 'today',
    meal_id,
    date: dayDate,
    slot,
    analysis_id: analysisId,
    finish,
  } = useLocalSearchParams<{
    destination?: 'meal' | 'day' | 'today';
    meal_id?: string;
    date?: string;
    slot?: string;
    analysis_id?: string;
    /** '1' from today's meal step: recording the food also marks the meal eaten. */
    finish?: string;
  }>();
  const analysis = photoDraft.get(analysisId);
  const [items, setItems] = useState<ReviewItem[]>(() =>
    (analysis?.items ?? []).map((item) => ({
      ...item,
      grams: Math.round(item.grams),
      skipped: false,
      confirmed: false,
      selected: item.food_id
        ? item.alternatives.find((option) => option.food_id === item.food_id) ?? {
            food_id: item.food_id,
            category_id: item.category_id ?? '',
            label: item.label,
          }
        : null,
    })),
  );
  // Opened from 補記點心 on another day, the photo is recorded for that day.
  const [recordDate, setRecordDate] = useState(() => dayDate ?? today());
  const [busy, setBusy] = useState(false);
  // The whole library is small enough to load once: it prices each row and backs the search.
  const [library, setLibrary] = useState<Food[] | null>(null);
  const [searching, setSearching] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  // Set once the foods are on the day, so retrying a failed "mark eaten" cannot add them twice.
  const addedToDay = useRef(false);

  useEffect(() => {
    api.get('/foods').then(setLibrary).catch(() => setLibrary([]));
  }, []);
  const foodsById = useMemo(() => new Map((library ?? []).map((food) => [food.id, food])), [library]);
  const searchHits = useMemo(() => foodsNamed(library ?? [], query), [library, query]);

  if (!analysis) {
    return (
      <Screen>
        <Title>找不到辨識結果</Title>
        <Hint>請先選擇餐點照片再進行辨識。</Hint>
        <PrimaryButton
          onPress={() =>
            router.replace({
              pathname: '/meals/photo',
              params: { destination, meal_id, date: dayDate, slot },
            })
          }
        >
          選擇照片
        </PrimaryButton>
      </Screen>
    );
  }

  const update = (index: number, changes: Partial<ReviewItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  const updateEstimate = (index: number, field: MacroField, value: number) =>
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index || !item.estimate) return item;
        const estimate = { ...item.estimate, [field]: value };
        estimate.kcal_per_100g = kcalFromMacros(
          estimate.protein_per_100g,
          estimate.carb_per_100g,
          estimate.fat_per_100g,
        );
        return { ...item, estimate };
      }),
    );
  const kcalPer100g = (item: ReviewItem) =>
    item.selected ? foodsById.get(item.selected.food_id)?.per_100g.kcal : item.estimate?.kcal_per_100g;
  const included = items.filter(
    (item) => !item.skipped && (item.selected || item.estimate) && item.grams > 0,
  );
  const totalKcal = included.reduce((sum, item) => sum + ((kcalPer100g(item) ?? 0) * item.grams) / 100, 0);
  const slotLabel = slot ? SLOT_LABEL[slot] ?? '目前餐次' : '目前餐次';

  const resolveIncludedFoods = async () => {
    const resolved: { item: ReviewItem; food: Food }[] = [];
    for (const [index, item] of items.entries()) {
      if (item.skipped || item.grams <= 0 || (!item.selected && !item.estimate)) continue;

      const label = item.selected?.label ?? item.label;
      let food = item.selected ? foodsById.get(item.selected.food_id) : undefined;
      if (!food) {
        const choices: Food[] = await api.get(`/foods?q=${encodeURIComponent(label)}`);
        food = item.selected
          ? choices.find((candidate) => candidate.id === item.selected!.food_id)
          : choices.find(
              (candidate) =>
                candidate.name.trim().toLocaleLowerCase() === item.label.trim().toLocaleLowerCase(),
            );
      }

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
        const selected = libraryPick(food);
        update(index, { selected, alternatives: [selected, ...item.alternatives], confirmed: true });
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
      Alert.alert('日期格式不正確', '請輸入 YYYY-MM-DD，例如 2026-09-23。');
      return;
    }
    setBusy(true);
    try {
      const foods = await resolveIncludedFoods();
      await Promise.all(
        foods.map(({ item, food }) =>
          api.post(`/days/${recordDate}/meals/extras/items`, {
            food_id: food.id,
            grams: item.grams,
            photo_id: analysis.id,
          }),
        ),
      );
      photoDraft.clear(analysisId);
      Alert.alert('已記錄', `已將 ${included.length} 項食物記錄到 ${recordDate}。`, [
        { text: '好', onPress: () => router.dismissTo('/today') },
      ]);
    } catch (error) {
      Alert.alert('記錄失敗', error instanceof ApiError ? error.message : '請稍後再試。');
    } finally {
      setBusy(false);
    }
  };

  const addToDay = async () => {
    if (!dayDate || !slot || !SLOT_LABEL[slot]) {
      Alert.alert('找不到餐次', '請回到今日流程重新選擇早餐、午餐或晚餐。');
      return;
    }
    setBusy(true);
    try {
      if (!addedToDay.current) {
        const foods = await resolveIncludedFoods();
        for (const { item, food } of foods) {
          await api.post(`/days/${dayDate}/plan/${slot}/items`, {
            food_id: food.id,
            grams: item.grams,
            photo_id: analysis.id,
          });
        }
        addedToDay.current = true;
      }
      if (finish === '1') await api.patch(`/days/${dayDate}/meals/${slot}`, { state: 'eaten' });
      photoDraft.clear(analysisId);
      router.dismissTo('/today');
    } catch (error) {
      Alert.alert(
        addedToDay.current ? '已加入，但沒有標記吃完' : '加入餐次失敗',
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : '請稍後再試。',
      );
    } finally {
      setBusy(false);
    }
  };

  // The row's own category first: replacing a rice usually means another staple, not an oil.
  const searchCategory =
    searching === null ? undefined : items[searching]?.selected?.category_id ?? items[searching]?.estimate?.category_id;
  const orderedHits = searchCategory
    ? [...searchHits].sort((a, b) => Number(b.category_id === searchCategory) - Number(a.category_id === searchCategory))
    : searchHits;

  const openSearch = (index: number) => {
    setQuery('');
    setSearching(index);
  };
  const pickFromSearch = (food: Food) => {
    if (searching === null) return;
    update(searching, { selected: libraryPick(food), skipped: false, confirmed: true });
    setSearching(null);
  };

  return (
    <Screen
      footer={
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-sm text-muted">
              {destination === 'today' ? `${recordDate}・` : ''}已選 {included.length} 項
            </Text>
            <Text className="text-sm text-muted">約 {Math.round(totalKcal).toLocaleString()} 大卡</Text>
          </View>
          {destination === 'meal' ? (
            <PrimaryButton onPress={addToMeal} disabled={included.length === 0} busy={busy}>
              {busy ? '加入中…' : `加入目前餐點 (${included.length})`}
            </PrimaryButton>
          ) : destination === 'day' ? (
            <PrimaryButton onPress={addToDay} disabled={included.length === 0} busy={busy}>
              {busy
                ? '記錄中…'
                : finish === '1'
                  ? `記錄${slotLabel}並標記吃完`
                  : `加入${slotLabel} (${included.length})`}
            </PrimaryButton>
          ) : (
            <PrimaryButton onPress={recordToday} disabled={included.length === 0} busy={busy}>
              {busy ? '記錄中…' : `只記錄這一天 (${included.length})`}
            </PrimaryButton>
          )}
        </View>
      }
    >
      <BackLink
        label="重新選照片"
        onPress={() => {
          photoDraft.clear(analysisId);
          router.replace({
            pathname: '/meals/photo',
            params: { destination, meal_id, date: dayDate, slot },
          });
        }}
        disabled={busy}
      />
      <Title sub="份量不對就直接改；認錯的食物，點「換成其他食物」。">辨識結果</Title>

      {destination === 'today' ? (
        <View className="gap-2">
          <Field
            label="記錄日期"
            value={recordDate}
            onChangeText={setRecordDate}
            placeholder="YYYY-MM-DD"
          />
          <View className="flex-row">
            <Chip
              label="今天"
              selected={recordDate === today()}
              onPress={() => setRecordDate(today())}
            />
          </View>
        </View>
      ) : null}

      {items.length === 0 ? <Hint>沒有辨識到可加入的食物，請改用手動加入。</Hint> : null}
      <Card className="px-4 py-0">
        <Rows>
          {items.map((item, index) => (
            // Keyed by position: the label is editable, and a key that changes remounts the row mid-typing.
            <ReviewRow
              key={index}
              item={item}
              kcalPer100g={kcalPer100g(item)}
              library={library}
              onChange={(changes) => update(index, changes)}
              onEstimate={(field, value) => updateEstimate(index, field, value)}
              onSearch={() => openSearch(index)}
            />
          ))}
        </Rows>
      </Card>
      {destination === 'today' ? (
        <Hint>「只記錄這一天」會新增每日額外食物，不會建立或覆寫命名餐點。</Hint>
      ) : destination === 'day' ? (
        <Hint>確認後會加入今天的{slotLabel}，不會修改原本的命名餐點。</Hint>
      ) : null}

      <Sheet visible={searching !== null} title="換成其他食物" onClose={() => setSearching(null)}>
        <Field value={query} onChangeText={setQuery} placeholder="搜尋食物名稱或別名" />
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          {library === null ? (
            <ActivityIndicator color={color.primary} />
          ) : orderedHits.length === 0 ? (
            <Hint>找不到符合的食物。換個關鍵字，或到食物庫新增自訂食物。</Hint>
          ) : (
            <Card className="px-0 py-0">
              <Rows>
                {orderedHits.map((food) => (
                  <FoodOptionRow
                    key={food.id}
                    name={food.name}
                    detail={describeFood(food)}
                    selected={searching !== null && items[searching]?.selected?.food_id === food.id}
                    onPress={() => pickFromSearch(food)}
                  />
                ))}
              </Rows>
            </Card>
          )}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

/**
 * One recognized food. Compact by default — name, portion and calories — because most rows
 * only need the portion checked. The fix-up section holds the other candidates, the AI
 * estimate and the library search.
 */
function ReviewRow({
  item,
  kcalPer100g,
  library,
  onChange,
  onEstimate,
  onSearch,
}: {
  item: ReviewItem;
  kcalPer100g: number | undefined;
  library: Food[] | null;
  onChange: (changes: Partial<ReviewItem>) => void;
  onEstimate: (field: MacroField, value: number) => void;
  onSearch: () => void;
}) {
  // A row with nothing it could record starts open, since it cannot be saved as it is.
  const [open, setOpen] = useState(!item.selected && !item.estimate);
  const confidence = item.selected
    ? Math.min(item.recognition_confidence, item.match_confidence)
    : item.recognition_confidence;
  const kcal = kcalPer100g === undefined ? null : Math.round((item.grams * kcalPer100g) / 100);
  // Typing a better name for an unmatched food offers the library foods it may mean.
  const named = !item.selected && library ? foodsNamed(library, item.label).slice(0, 4) : [];
  const pick = (selected: RecognizedFood) => onChange({ selected, skipped: false, confirmed: true });

  return (
    <View className={`gap-2 py-3 ${item.skipped ? 'opacity-40' : ''}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-ink">{item.selected?.label ?? item.label}</Text>
          {/* Shows the pairing, so "豬肉片 → 梅花豬(熟)" can be checked at a glance. */}
          {item.selected && bareName(item.selected.label) !== bareName(item.label) ? (
            <Text className="text-sm text-muted">看起來是：{item.label}</Text>
          ) : null}
          {item.selected && (item.confirmed || confidence >= 0.8) ? null : (
            <View className="flex-row flex-wrap gap-2">
              {item.selected ? null : <Chip label="AI 估算營養" tone="warm" />}
              {item.confirmed || confidence >= 0.8 ? null : <Confidence confidence={confidence} />}
            </View>
          )}
        </View>
        <TextAction label={item.skipped ? '恢復' : '略過'} onPress={() => onChange({ skipped: !item.skipped })} />
      </View>
      <View className="flex-row items-end gap-3">
        <DecimalField
          label="份量"
          value={item.grams}
          onChange={(grams) => onChange({ grams })}
          suffix="g"
          editable={!item.skipped}
        />
        <View className="h-11 w-24 items-end justify-center">
          <Text className="text-base font-semibold text-ink">{kcal === null ? '—' : `${kcal} 大卡`}</Text>
        </View>
      </View>
      <TextAction label={open ? '收起' : '換成其他食物'} onPress={() => setOpen(!open)} />

      {open ? (
        <View className="gap-3 rounded-card border border-line p-3">
          {item.alternatives.length ? (
            <View className="gap-2">
              <Text className="text-sm text-muted">可能是</Text>
              <View className="flex-row flex-wrap gap-2">
                {item.alternatives.map((option) => (
                  <Chip
                    key={option.food_id}
                    label={option.label}
                    selected={item.selected?.food_id === option.food_id}
                    onPress={() => pick(option)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {item.selected ? (
            item.estimate ? (
              <TextAction label="改回 AI 估算" onPress={() => onChange({ selected: null })} />
            ) : null
          ) : item.estimate ? (
            <>
              <Field
                label="食物名稱"
                value={item.label}
                onChangeText={(label) => onChange({ label })}
                editable={!item.skipped}
              />
              {named.length ? (
                <View className="gap-2">
                  <Text className="text-sm text-muted">食物庫裡的</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {named.map((food) => (
                      <Chip key={food.id} label={food.name} onPress={() => pick(libraryPick(food))} />
                    ))}
                  </View>
                </View>
              ) : null}
              <Hint>食物庫找不到的話，會用下面 AI 估算的營養素新增到你的食物庫。</Hint>
              <View className="flex-row gap-2">
                <DecimalField
                  label="蛋白質"
                  value={item.estimate.protein_per_100g}
                  onChange={(value) => onEstimate('protein_per_100g', value)}
                  suffix="g"
                  editable={!item.skipped}
                />
                <DecimalField
                  label="碳水"
                  value={item.estimate.carb_per_100g}
                  onChange={(value) => onEstimate('carb_per_100g', value)}
                  suffix="g"
                  editable={!item.skipped}
                />
              </View>
              <DecimalField
                label="脂肪"
                value={item.estimate.fat_per_100g}
                onChange={(value) => onEstimate('fat_per_100g', value)}
                suffix="g"
                editable={!item.skipped}
              />
              <Hint>每 100 g 約 {Math.round(item.estimate.kcal_per_100g)} 大卡</Hint>
            </>
          ) : (
            <Hint>食物庫找不到這一項，請搜尋食物庫，或略過。</Hint>
          )}

          <PrimaryButton tone="plain" onPress={onSearch}>
            搜尋食物庫
          </PrimaryButton>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Library foods a name could mean, matched either way round, so a fuller name such as
 * "滷板豆腐" still finds "板豆腐". Parenthesized notes like "(熟)" are ignored. An empty
 * name lists everything.
 */
function foodsNamed(foods: Food[], name: string) {
  const query = name.trim().toLocaleLowerCase();
  if (!query) return foods;
  return foods.filter((food) =>
    [food.name, ...food.aliases].some((text) => {
      const known = bareName(text);
      return known.includes(query) || (known.length >= 2 && query.includes(known));
    }),
  );
}

/** A food name without notes such as "(熟)", for comparing names. */
function bareName(text: string) {
  return text.replace(/[(（][^)）]*[)）]/g, '').trim().toLocaleLowerCase();
}

/** Keeps the typed text ("2.", "") so decimals and clearing work, and reports it as a number. */
function DecimalField({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Field>, 'value' | 'onChange' | 'onChangeText' | 'keyboardType'> & {
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(() => String(value));
  return (
    <Field
      {...props}
      value={text}
      onChangeText={(next) => {
        setText(next);
        onChange(Number(next) || 0);
      }}
      keyboardType="decimal-pad"
    />
  );
}

function Confidence({ confidence }: { confidence: number }) {
  const state = confidence >= 0.8 ? ['信心高', 'good'] : confidence >= 0.5 ? ['需確認', 'warm'] : ['信心低', 'neutral'];
  return <Chip label={`${state[0]} ${Math.round(confidence * 100)}%`} tone={state[1] as 'good' | 'warm' | 'neutral'} />;
}
