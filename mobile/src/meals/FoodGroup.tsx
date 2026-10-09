/**
 * A food list: per category a coloured label and a card of foods. A food opens in place to show
 * its macros and what can be done with it.
 */
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import {
  ChevronIcon,
  DropletIcon,
  FruitIcon,
  GrainIcon,
  LeafIcon,
  ProteinIcon,
  UtensilsIcon,
} from '@/components/icons';
import { Text } from '@/components/text';
import { PrimaryButton } from '@/components/ui';
import { color, foodCategoryTone } from '@/theme/tokens';

type Nutrients = Schema<'NutrientsOut'>;

const CATEGORY_ICON: Record<string, typeof UtensilsIcon> = {
  staple: GrainIcon,
  protein: ProteinIcon,
  vegetable: LeafIcon,
  fruit: FruitIcon,
  fat_sauce: DropletIcon,
};

/** A category's label and count, then its `FoodItem` rows in one outlined card. */
export function FoodGroup({ category, label, children }: { category: string; label: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  const Glyph = CATEGORY_ICON[category] ?? UtensilsIcon;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View
          className="flex-row items-center gap-1 rounded-full border-[1.5px] border-edge px-2.5 py-1"
          style={{ backgroundColor: foodCategoryTone(category).soft }}
        >
          <Glyph size={13} tint={color.ink} />
          <Text className="text-xs text-ink">{label}</Text>
        </View>
        <Text className="text-xs text-muted">{rows.length} 項</Text>
      </View>
      <View className="overflow-hidden rounded-tile border-[1.5px] border-edge bg-surface">
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
            {index > 0 ? <View className="h-px bg-line" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** One food: its name and calories, its amount, and `children` under it while it is open. */
export function FoodItem({
  name,
  kcal,
  amount,
  open,
  busy,
  onToggle,
  children,
}: {
  name: string;
  kcal: number;
  /** The portion as shown ("30 g"); empty for a food typed in by hand. */
  amount: string;
  open: boolean;
  busy?: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <View className={open ? 'bg-warm-soft' : ''}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}，${kcal} 大卡${amount ? `，${amount}` : ''}`}
        accessibilityState={{ expanded: open, disabled: Boolean(busy) }}
        disabled={busy}
        onPress={onToggle}
        className="min-h-[66px] flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] text-ink">{name}</Text>
          <Text className="text-xs text-muted">{kcal} 大卡</Text>
        </View>
        {amount ? <Text className="text-sm text-ink">{amount}</Text> : null}
        <ChevronIcon direction={open ? 'down' : 'right'} size={15} tint={color.ink} />
      </Pressable>
      {open && children ? <View className="gap-3 border-t border-line px-4 pb-4 pt-3">{children}</View> : null}
    </View>
  );
}

/** Protein, carbs and fat of one food, side by side in its open row. */
export function FoodMacros({ nutrients }: { nutrients: Nutrients }) {
  const columns = [
    { label: '蛋白質', value: nutrients.protein_g },
    { label: '碳水', value: nutrients.carb_g },
    { label: '脂肪', value: nutrients.fat_g },
  ];
  return (
    <View className="flex-row">
      {columns.map((column) => (
        <View key={column.label} className="flex-1 gap-0.5">
          <Text className="text-xs text-muted">{column.label}</Text>
          <Text className="text-[21px] text-ink">
            {Math.round(column.value * 10) / 10}
            <Text className="text-xs text-muted"> g</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

/** What can be done with an open food, as outlined buttons side by side. */
export function FoodActions({
  actions,
  busy,
}: {
  actions: { label: string; onPress: () => void; danger?: boolean }[];
  busy?: boolean;
}) {
  return (
    <View className="flex-row gap-2">
      {actions.map((action) => (
        <View key={action.label} className="flex-1">
          <PrimaryButton tone={action.danger ? 'danger' : 'plain'} onPress={action.onPress} disabled={busy}>
            {action.label}
          </PrimaryButton>
        </View>
      ))}
    </View>
  );
}
