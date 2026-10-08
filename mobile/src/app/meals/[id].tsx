import { router, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { CameraIcon, PlusIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { AddRow, BackLink, Card, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { draft, useDraft, type DraftItem } from '@/meals/draft';
import { FoodGroup, FoodItem } from '@/meals/FoodGroup';
import { amountToGrams, formatPortion, gramsToAmount, portionUnit, readableAmount } from '@/meals/portion';
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

const SLOTS = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
] as const;

export default function EditMeal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const current = useDraft(id ?? '');
  const navigation = useNavigation();
  const [allowLeave, setAllowLeave] = useState(false);

  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Nutrients | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  const addFrom = (path: Href) => {
    setAdding(false);
    requestAnimationFrame(() => router.navigate(path));
  };

  const remove = () =>
    Alert.alert('刪除餐點', '之後就不能從我的餐點選這道。已經吃過的紀錄不受影響。', [
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
      <BackLink label="餐點" onPress={() => backOrReplace('/meals')} disabled={busy} />

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

      <Text className="font-display text-xl font-bold text-ink">組成</Text>

      {/* Drawn like the today list: a block per category, then one dashed row to add. */}
      <View className="gap-2.5">
        {grouped.length ? (
          <Card className="gap-3 p-2">
            {grouped.map((group) => (
              <FoodGroup
                key={group.category}
                category={group.category}
                label={CATEGORY_LABEL[group.category] ?? group.category}
              >
                {group.items.map((item) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    draftKey={id}
                    open={editing === item.key}
                    onToggle={() => setEditing((current) => (current === item.key ? null : item.key))}
                  />
                ))}
              </FoodGroup>
            ))}
          </Card>
        ) : null}
        <AddRow label="加入食物" onPress={() => setAdding(true)} />
      </View>

      <Sheet visible={adding} title="加入食物" onClose={() => setAdding(false)}>
        <PrimaryButton tone="plain" icon={PlusIcon} onPress={() => addFrom(`/meals/add-food?meal_id=${id}`)}>
          從食物庫加入
        </PrimaryButton>
        <PrimaryButton
          tone="plain"
          icon={CameraIcon}
          onPress={() => addFrom(`/meals/photo?destination=meal&meal_id=${id}`)}
        >
          用照片加入
        </PrimaryButton>
      </Sheet>

      {isNew ? null : (
        <PrimaryButton tone="danger" onPress={remove}>
          刪除這道餐點
        </PrimaryButton>
      )}
    </Screen>
  );
}

function ItemRow({
  item,
  draftKey,
  open,
  onToggle,
}: {
  item: DraftItem;
  draftKey: string;
  open: boolean;
  onToggle: () => void;
}) {
  const unit = portionUnit(item.food);
  const display = readableAmount(gramsToAmount(item.food, item.grams));

  const onChange = (text: string) => {
    const value = Number(text);
    if (!value || value <= 0) return;
    draft.setGrams(draftKey, item.key, amountToGrams(item.food, value));
  };

  const kcal = Math.round((item.food.per_100g.kcal * item.grams) / 100);

  return (
    <FoodItem
      name={item.food.name}
      amount={formatPortion(item.food, item.grams)}
      open={open}
      onReplace={() =>
        router.navigate(
          `/meals/substitute?meal_id=${draftKey}&key=${item.key}&food=${item.food.id}&grams=${item.grams}`,
        )
      }
      onAmount={onToggle}
      onRemove={() => draft.removeItem(draftKey, item.key)}
    >
      <Field label="份量" value={display} onChangeText={onChange} suffix={unit.label} keyboardType="decimal-pad" />
      <Text className="text-sm text-muted">{kcal} 大卡</Text>
    </FoodItem>
  );
}
