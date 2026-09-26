import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Card, Chip, Field, Hint, PrimaryButton, Rows, Screen, Title } from '@/components/ui';
import { draft, useDraft, type DraftItem } from '@/meals/draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Nutrients = Schema<'NutrientsOut'>;

const CATEGORY_LABEL: Record<string, string> = {
  staple: '主食',
  protein: '蛋白質',
  vegetable: '蔬菜',
  fruit: '水果',
  fat_sauce: '油脂與醬料',
};

const CATEGORY_ORDER = ['staple', 'protein', 'vegetable', 'fruit', 'fat_sauce'];

const SWAP_NOTE: Record<string, string> = {
  staple: '依碳水換算,份量隨目標自動調整',
  protein: '依蛋白質換算',
  vegetable: '依熱量換算',
  fruit: '依碳水換算',
  fat_sauce: '依熱量換算',
};

const SLOTS = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
] as const;

const TAGS = [
  { id: 'regular', label: '日常' },
  { id: 'light', label: '清淡' },
  { id: 'occasional', label: '偶爾吃' },
] as const;

export default function EditMeal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const current = useDraft(id ?? '');
  const navigation = useNavigation();
  const { profile } = useSession();
  const [allowLeave, setAllowLeave] = useState(false);

  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Nutrients | null>(null);

  useEffect(() => {
    let live = true;
    if (!id) {
      backOrReplace('/meals');
      return;
    }
    if (draft.has(id)) return;
    void (async () => {
      try {
        const meal = isNew ? null : await api.get(`/meals/${id}`);
        if (live) draft.start(id, meal);
      } catch (error) {
        Alert.alert('讀不到餐點', error instanceof ApiError ? error.message : '請稍後再試', [
          { text: '返回餐點', onPress: () => backOrReplace('/meals') },
        ]);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, isNew]);

  const ready = Boolean(id && draft.has(id));

  usePreventRemove(Boolean(id && draft.isDirty(id) && !allowLeave), ({ data }) => {
    if (busy || !id) return;
    Alert.alert('放棄未儲存的修改？', '這次編輯的內容將不會保留。', [
      { text: '繼續編輯', style: 'cancel' },
      {
        text: '放棄',
        style: 'destructive',
        onPress: () => {
          setAllowLeave(true);
          draft.clear(id);
          requestAnimationFrame(() => navigation.dispatch(data.action));
        },
      },
    ]);
  });

  useEffect(
    () => () => {
      if (id && !draft.isDirty(id)) draft.clear(id);
    },
    [id],
  );

  // The running total comes from the server so it matches the saved meal exactly.
  useEffect(() => {
    if (!ready || current.items.length === 0) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const result = await api.post('/meals/calculate', {
          items: current.items.map((i) => ({ food_id: i.food.id, grams: i.grams })),
        });
        if (live) setTotals(result);
      } catch {
        if (live) setTotals(null);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [current.items, ready]);

  const save = async () => {
    setBusy(true);
    try {
      if (isNew) await api.post('/meals', draft.payload(id));
      else await api.patch(`/meals/${id}`, draft.payload(id));
      setAllowLeave(true);
      draft.clear(id);
      requestAnimationFrame(() => backOrReplace('/meals'));
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert('刪除餐點', '之後的自動分配不會再排到這道。已經吃過的紀錄不受影響。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
          onPress: async () => {
            await api.delete(`/meals/${id}`);
            setAllowLeave(true);
            draft.clear(id);
            requestAnimationFrame(() => backOrReplace('/meals'));
        },
      },
    ]);

  if (!ready) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: current.items.filter((i) => i.food.category_id === category),
  })).filter((group) => group.items.length > 0);

  const shownTotals = current.items.length > 0 ? totals : null;
  const autoScaled = profile?.profile.auto_scale_carbs && (profile?.targets.carb_scale ?? 1) !== 1;

  return (
    <Screen
      footer={
        <>
          <View className="flex-row items-baseline justify-between">
            <Text className="text-base text-muted">整份餐點</Text>
            <Text className="font-display text-2xl font-bold text-ink">
              {shownTotals ? Math.round(shownTotals.kcal).toLocaleString() : '—'}{' '}
              <Text className="text-sm font-normal text-muted">大卡</Text>
            </Text>
          </View>
          {shownTotals ? (
            <Hint>
              蛋白質 {Math.round(shownTotals.protein_g)} g、脂肪 {Math.round(shownTotals.fat_g)} g、
              碳水 {Math.round(shownTotals.carb_g)} g
            </Hint>
          ) : (
            <Hint>加入食物後自動計算。</Hint>
          )}
          <PrimaryButton
            onPress={save}
            disabled={busy || !current.name || current.items.length === 0}
          >
            {busy ? '儲存中…' : '儲存餐點'}
          </PrimaryButton>
        </>
      }
    >
      <Pressable accessibilityRole="button" onPress={() => backOrReplace('/meals')} disabled={busy}>
        <Text className="text-base text-primary">‹ 我的餐點</Text>
      </Pressable>

      <Title>{isNew ? '新增餐點' : '編輯餐點'}</Title>

      <Field
        label="餐點名稱"
        value={current.name}
              onChangeText={(name) => draft.set(id, { name })}
        placeholder="乾煎雞腿＋蛋花湯"
      />

      <View className="gap-1">
        <Text className="text-sm text-muted">適合的時段</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((slot) => (
            <Chip
              key={slot.id}
              label={slot.label}
              selected={current.mealTimes.includes(slot.id)}
              onPress={() => draft.toggleMealTime(id, slot.id)}
            />
          ))}
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-sm text-muted">分類</Text>
        <View className="flex-row gap-2">
          {TAGS.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.label}
              selected={current.tag === tag.id}
              onPress={() => draft.set(id, { tag: tag.id })}
            />
          ))}
        </View>
      </View>

      <Text className="font-display text-xl font-bold text-ink">組成</Text>

      {grouped.length ? (
        <Card className="px-4 py-0">
          <Rows>
            {grouped.map((group) => (
              <View key={group.category} className="gap-2 py-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Chip label={CATEGORY_LABEL[group.category]} tone="primary" />
                    <Text className="flex-1 text-xs text-muted">{SWAP_NOTE[group.category]}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                     onPress={() => router.navigate(`/meals/add-food?category=${group.category}&meal_id=${id}`)}
                    className="min-h-[44px] justify-center pl-2"
                  >
                    <Text className="text-base text-primary underline">
                      ＋ {CATEGORY_LABEL[group.category]}
                    </Text>
                  </Pressable>
                </View>

                {group.items.map((item) => (
                  <ItemRow
                    key={item.key}
                     item={item}
                     draftKey={id}
                    scaled={Boolean(autoScaled) && group.category === 'staple'}
                  />
                ))}
              </View>
            ))}
          </Rows>
        </Card>
      ) : null}

       <Pressable
         accessibilityRole="button"
         onPress={() => router.navigate(`/meals/add-food?meal_id=${id}`)}
        className="min-h-[52px] items-center justify-center rounded-field border border-dashed border-line"
      >
         <Text className="text-base text-primary">＋ 加入食物</Text>
       </Pressable>

       <Pressable
         accessibilityRole="button"
         onPress={() => router.navigate(`/meals/photo?destination=meal&meal_id=${id}`)}
         className="min-h-[52px] items-center justify-center rounded-field border border-dashed border-line"
       >
         <Text className="text-base text-primary">⌁ 用照片加入食物</Text>
       </Pressable>

      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={remove}
          className="min-h-[52px] items-center justify-center"
        >
          <Text className="text-base text-primary">刪除這道餐點</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function ItemRow({ item, draftKey, scaled }: { item: DraftItem; draftKey: string; scaled: boolean }) {
  const unitLabel =
    item.food.unit === 'piece' ? '顆' : item.food.unit === 'scoop' ? '匙' : item.food.unit;
  const display =
    item.food.grams_per_unit && item.food.unit !== 'g'
      ? String(Math.round((item.grams / item.food.grams_per_unit) * 10) / 10)
      : String(Math.round(item.grams));

  const onChange = (text: string) => {
    const value = Number(text);
    if (!value || value <= 0) return;
    const grams =
      item.food.grams_per_unit && item.food.unit !== 'g'
        ? value * item.food.grams_per_unit
        : value;
    draft.setGrams(draftKey, item.key, grams);
  };

  const kcal = Math.round((item.food.per_100g.kcal * item.grams) / 100);

  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between">
        <Text className="flex-1 text-base font-semibold text-ink">{item.food.name}</Text>
        <Text className="text-sm text-muted">{kcal} 大卡</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Field value={display} onChangeText={onChange} suffix={unitLabel} keyboardType="decimal-pad" />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.navigate(
              `/meals/substitute?meal_id=${draftKey}&key=${item.key}&food=${item.food.id}&grams=${item.grams}`,
            )
          }
          className="min-h-[44px] justify-center rounded-field bg-fill px-4"
        >
          <Text className="text-base text-ink">替換</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除${item.food.name}`}
          onPress={() => draft.removeItem(draftKey, item.key)}
          className="h-11 w-11 items-center justify-center"
        >
          <Text className="text-lg text-muted">✕</Text>
        </Pressable>
      </View>

      {scaled ? <Hint>主食份量會隨熱量目標自動調整,這裡顯示的是基準克數。</Hint> : null}
    </View>
  );
}
