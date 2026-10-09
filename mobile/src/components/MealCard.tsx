/** A saved meal in the 我的餐點 list; tapping it opens the meal for editing. */
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Tag } from '@/components/ui';
import { color } from '@/theme/tokens';

type Meal = Schema<'MealOut'>;

const SLOT_LABEL: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};

// The API returns a meal's slots in no particular order; show them the way the day runs.
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner'];

const SLOT_TONE: Record<string, 'warm' | 'primary' | 'purple'> = {
  breakfast: 'warm',
  lunch: 'primary',
  dinner: 'purple',
};

/** A saved meal in the list: its name and calories, the meals it suits and what is in it. */
export function MealCard({ meal, onOpen }: { meal: Meal; onOpen: () => void }) {
  const summary = meal.items.map((item) => item.food.name).join('・');
  const slots = [...meal.meal_times].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`編輯${meal.name}，${Math.round(meal.nutrients.kcal)} 大卡`}
      onPress={onOpen}
      className="min-h-[96px] flex-row items-start gap-3 rounded-tile border-[1.5px] border-edge bg-surface px-4 py-3 active:bg-warm-soft"
    >
      <View className="flex-1 gap-1.5">
        <Text className="text-[15px] text-ink">{meal.name}</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {slots.map((slot) => (
            <Tag key={slot} label={SLOT_LABEL[slot] ?? slot} tone={SLOT_TONE[slot] ?? 'neutral'} />
          ))}
        </View>
        <Text className="text-xs text-muted" numberOfLines={2}>
          {summary || '還沒有食物'}
        </Text>
      </View>
      <View className="items-end gap-2">
        <Text className="text-sm text-ink">
          {Math.round(meal.nutrients.kcal)}
          <Text className="text-xs text-muted"> 大卡</Text>
        </Text>
        <ChevronIcon direction="right" size={15} tint={color.ink} />
      </View>
    </Pressable>
  );
}
