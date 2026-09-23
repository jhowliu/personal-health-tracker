/** A meal in the list, grouped by food category the way the wireframe shows it. */
import { Pressable, Text, View } from 'react-native';

import type { Schema } from '@/api/client';

type Meal = Schema<'MealOut'>;

const CATEGORY_LABEL: Record<string, string> = {
  staple: '主食',
  protein: '蛋白質',
  vegetable: '蔬菜',
  fruit: '水果',
  fat_sauce: '油脂與醬料',
};

const CATEGORY_ORDER = ['staple', 'protein', 'vegetable', 'fruit', 'fat_sauce'];

const SLOT_LABEL: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

const TAG_LABEL: Record<string, string> = {
  regular: '',
  light: '清淡',
  occasional: '偶爾吃',
};

export function formatGrams(item: Schema<'MealItemOut'>): string {
  const { grams_per_unit, unit } = item.food;
  if (grams_per_unit && unit === 'piece') {
    return `${item.food.name} ${Math.round(item.grams / grams_per_unit)} 顆`;
  }
  if (grams_per_unit && unit === 'scoop') {
    const scoops = item.grams / grams_per_unit;
    return `${item.food.name} ${scoops % 1 === 0 ? scoops : scoops.toFixed(1)} 匙`;
  }
  if (unit === 'ml' && grams_per_unit) {
    return `${item.food.name} ${Math.round(item.grams / grams_per_unit)} ml`;
  }
  return `${item.food.name} ${Math.round(item.grams)} g`;
}

export function groupByCategory(items: Schema<'MealItemOut'>[]) {
  const groups = new Map<string, Schema<'MealItemOut'>[]>();
  for (const item of items) {
    const list = groups.get(item.category_id) ?? [];
    list.push(item);
    groups.set(item.category_id, list);
  }
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((category) => ({
    category,
    label: CATEGORY_LABEL[category] ?? category,
    items: groups.get(category) as Schema<'MealItemOut'>[],
  }));
}

export function MealCard({ meal, onPress }: { meal: Meal; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="gap-2 py-4"
    >
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-ink">{meal.name}</Text>
        <Text className="text-base text-muted">{Math.round(meal.nutrients.kcal)} 大卡</Text>
      </View>

      {groupByCategory(meal.items).map((group) => (
        <View key={group.category} className="flex-row gap-3">
          <Text className="w-20 text-sm text-muted">{group.label}</Text>
          <Text className="flex-1 text-sm text-ink">
            {group.items.map(formatGrams).join('、')}
          </Text>
        </View>
      ))}

      <View className="flex-row flex-wrap gap-1.5 pt-1">
        {meal.meal_times.map((slot) => (
          <View key={slot} className="rounded-full bg-fill px-2 py-0.5">
            <Text className="text-xs text-muted">{SLOT_LABEL[slot] ?? slot}</Text>
          </View>
        ))}
        {TAG_LABEL[meal.tag] ? (
          <View className="rounded-full bg-warm-soft px-2 py-0.5">
            <Text className="text-xs text-warm">{TAG_LABEL[meal.tag]}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
