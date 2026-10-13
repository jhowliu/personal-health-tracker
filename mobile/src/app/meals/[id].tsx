import { router, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { CameraIcon, PlusIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/text';
import { AddRow, BackLink, Chip, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
import { draft, useDraft, type DraftItem } from '@/meals/draft';
import { FoodActions, FoodGroup, FoodItem, FoodMacros } from '@/meals/FoodGroup';
import { amountToGrams, formatPortion, gramsToAmount, portionUnit, readableAmount } from '@/meals/portion';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Nutrients = Schema<'NutrientsOut'>;

const CATEGORY_ORDER = ['staple', 'protein', 'vegetable', 'fruit', 'fat_sauce'];

const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

export default function EditMeal() {
  const { t } = useI18n();
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
        Alert.alert(t('meals.editor.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'), [
          { text: t('meals.editor.back'), onPress: () => backOrReplace('/meals') },
        ]);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, isNew, t]);

  const ready = Boolean(id && draft.has(id));

  usePreventRemove(Boolean(id && draft.isDirty(id) && !allowLeave), ({ data }) => {
    if (busy || !id) return;
    Alert.alert(t('meals.editor.discardTitle'), t('meals.editor.discardBody'), [
      { text: t('meals.editor.continueEditing'), style: 'cancel' },
      {
        text: t('common.actions.discard'),
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
      Alert.alert(t('common.errors.cannotSave'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    } finally {
      setBusy(false);
    }
  };

  const addFrom = (path: Href) => {
    setAdding(false);
    requestAnimationFrame(() => router.navigate(path));
  };

  const remove = () =>
    Alert.alert(t('meals.editor.deleteTitle'), t('meals.editor.deleteBody'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('common.actions.delete'),
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
            <Text className="text-base text-muted">{t('meals.editor.wholeMeal')}</Text>
            <Text className="text-2xl text-ink">
              {shownTotals ? formatNumber(Math.round(shownTotals.kcal)) : '—'}{' '}
              <Text className="text-sm text-muted">{t('common.units.kcal')}</Text>
            </Text>
          </View>
          {shownTotals ? (
            <Hint>
              {t('meals.editor.macroSummary', {
                protein: Math.round(shownTotals.protein_g),
                fat: Math.round(shownTotals.fat_g),
                carbs: Math.round(shownTotals.carb_g),
              })}
            </Hint>
          ) : (
            <Hint>{t('meals.editor.autoCalculateHint')}</Hint>
          )}
          <PrimaryButton
            onPress={save}
            disabled={busy || !current.name || current.items.length === 0}
          >
            {busy ? t('common.states.saving') : t('meals.editor.saveMeal')}
          </PrimaryButton>
        </>
      }
    >
      <BackLink label={t('navigation.meals')} onPress={() => backOrReplace('/meals')} disabled={busy} />

      <Title>{isNew ? t('meals.editor.newTitle') : t('meals.editor.editTitle')}</Title>

      <Field
        label={t('meals.editor.mealName')}
        value={current.name}
              onChangeText={(name) => draft.set(id, { name })}
        placeholder={t('meals.editor.mealNamePlaceholder')}
      />

      <View className="gap-1">
        <Text className="text-sm text-muted">{t('meals.editor.suitableTimes')}</Text>
        <View className="flex-row gap-2">
          {SLOTS.map((slot) => (
            <Chip
              key={slot}
              label={t(`common.mealTimes.${slot}`)}
              selected={current.mealTimes.includes(slot)}
              onPress={() => draft.toggleMealTime(id, slot)}
            />
          ))}
        </View>
      </View>

      <Text className="text-xl text-ink">{t('meals.editor.composition')}</Text>

      {grouped.map((group) => (
        <FoodGroup
          key={group.category}
          category={group.category}
          label={t(`common.foodCategories.${group.category === 'fat_sauce' ? 'fatSauce' : group.category}` as 'common.foodCategories.staple')}
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
      <AddRow label={t('meals.editor.addFood')} onPress={() => setAdding(true)} />

      <Sheet visible={adding} title={t('meals.editor.addFood')} onClose={() => setAdding(false)}>
        <PrimaryButton tone="plain" icon={PlusIcon} onPress={() => addFrom(`/meals/add-food?meal_id=${id}`)}>
          {t('meals.editor.addFromLibrary')}
        </PrimaryButton>
        <PrimaryButton
          tone="plain"
          icon={CameraIcon}
          onPress={() => addFrom(`/meals/photo?destination=meal&meal_id=${id}`)}
        >
          {t('meals.editor.addFromPhoto')}
        </PrimaryButton>
      </Sheet>

      {isNew ? null : (
        <PrimaryButton tone="danger" onPress={remove}>
          {t('meals.editor.deleteMeal')}
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
  const { t } = useI18n();
  const unit = portionUnit(item.food);
  const display = readableAmount(gramsToAmount(item.food, item.grams));

  const onChange = (text: string) => {
    const value = Number(text);
    if (!value || value <= 0) return;
    draft.setGrams(draftKey, item.key, amountToGrams(item.food, value));
  };

  const per100 = item.food.per_100g;
  const share = item.grams / 100;
  const nutrients = {
    kcal: per100.kcal * share,
    protein_g: per100.protein_g * share,
    fat_g: per100.fat_g * share,
    carb_g: per100.carb_g * share,
  };

  return (
    <FoodItem
      name={item.food.name}
      kcal={Math.round(nutrients.kcal)}
      amount={formatPortion(item.food, item.grams)}
      open={open}
      onToggle={onToggle}
    >
      <Field label={t('common.labels.portion')} value={display} onChangeText={onChange} suffix={unit.label} keyboardType="decimal-pad" />
      <FoodMacros nutrients={nutrients} />
      <FoodActions
        actions={[
          {
            label: t('today.meal.replace'),
            onPress: () =>
              router.navigate(
                `/meals/substitute?meal_id=${draftKey}&key=${item.key}&food=${item.food.id}&grams=${item.grams}`,
              ),
          },
          { label: t('common.actions.remove'), onPress: () => draft.removeItem(draftKey, item.key), danger: true },
        ]}
      />
    </FoodItem>
  );
}
