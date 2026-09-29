/** A saved meal that expands in place to show its composition and actions. */
import { Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ExpandableCard } from '@/components/ExpandableCard';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { formatPortion } from '@/meals/portion';
import { color, foodCategoryColor } from '@/theme/tokens';

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

// The API returns a meal's slots in no particular order; show them the way the day runs.
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner'];

const TAG_LABEL: Record<string, string> = {
  regular: '',
  light: '清淡',
  occasional: '偶爾吃',
};

const SLOT_TONE: Record<string, { backgroundColor: string; color: string }> = {
  breakfast: {
    backgroundColor: foodCategoryColor.staple.soft,
    color: foodCategoryColor.staple.accent,
  },
  lunch: {
    backgroundColor: foodCategoryColor.protein.soft,
    color: foodCategoryColor.protein.accent,
  },
  dinner: {
    backgroundColor: foodCategoryColor.fat_sauce.soft,
    color: foodCategoryColor.fat_sauce.accent,
  },
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

export function MealCard({
  meal,
  expanded,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  meal: Meal;
  expanded: boolean;
  busy?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const groups = groupByCategory(meal.items);
  const summary = meal.items.map((item) => item.food.name).join('・');
  const slots = [...meal.meal_times].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));

  return (
    <ExpandableCard
      name={meal.name}
      expanded={expanded}
      busy={busy}
      onToggle={onToggle}
      summary={
        <>
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="flex-1 text-base font-semibold text-ink">{meal.name}</Text>
            <Text className="text-base text-muted">{Math.round(meal.nutrients.kcal)} 大卡</Text>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {slots.map((slot) => {
              const tone = SLOT_TONE[slot];
              return (
                <View
                  key={slot}
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: tone?.backgroundColor ?? color.fill }}
                >
                  <Text className="text-xs" style={{ color: tone?.color ?? color.muted }}>
                    {SLOT_LABEL[slot] ?? slot}
                  </Text>
                </View>
              );
            })}
            {TAG_LABEL[meal.tag] ? (
              <View className="rounded-full bg-warm-soft px-2 py-0.5">
                <Text className="text-xs text-warm">{TAG_LABEL[meal.tag]}</Text>
              </View>
            ) : null}
          </View>

          <Text className="text-sm text-muted" numberOfLines={1}>
            {summary || '還沒有食物'}
          </Text>
        </>
      }
      details={groups.map((group, groupIndex) => (
        <View key={group.category}>
          {groupIndex > 0 ? <View className="h-px bg-line" /> : null}
          <View className="flex-row items-start gap-3 py-3">
            <Text className="w-20 text-sm font-semibold text-ink">{group.label}</Text>
            <View className="flex-1 gap-1.5">
              {group.items.map((item) => (
                <View key={item.id} className="flex-row items-baseline justify-between gap-2">
                  <Text className="flex-1 text-sm text-ink">{item.food.name}</Text>
                  <Text className="text-sm text-muted">{formatPortion(item.food, item.grams)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
      actions={[
        {
          label: '編輯餐點',
          accessibilityLabel: `編輯${meal.name}`,
          icon: PencilIcon,
          onPress: onEdit,
        },
        {
          label: '刪除',
          accessibilityLabel: `刪除${meal.name}`,
          icon: TrashIcon,
          onPress: onDelete,
          tone: 'danger',
        },
      ]}
    />
  );
}
