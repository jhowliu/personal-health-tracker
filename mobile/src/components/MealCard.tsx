/** A meal in the list, grouped by food category the way the wireframe shows it. */
import { Pressable, Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon } from '@/components/icons';
import { formatPortion } from '@/meals/portion';
import { color } from '@/theme/tokens';

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
  return `${item.food.name} ${formatPortion(item.food, item.grams)}`;
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
      accessibilityLabel={`編輯${meal.name}`}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3 py-3"
    >
      <View className="flex-1 gap-2">
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
      </View>
      <ChevronIcon direction="right" size={16} tint={color.muted} />
    </Pressable>
  );
}
