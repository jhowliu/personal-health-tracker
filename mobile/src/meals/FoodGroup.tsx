/** A food list: one coloured block per category, its foods on white rows inside. */
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronIcon, CloseIcon } from '@/components/icons';
import { color, foodCategoryTone } from '@/theme/tokens';

/** A category's block: its colour, name and count, then its `FoodItem` rows. */
export function FoodGroup({ category, label, children }: { category: string; label: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View className="overflow-hidden rounded-card" style={{ backgroundColor: foodCategoryTone(category).soft }}>
      <View className="min-h-[52px] flex-row items-center gap-3 px-3 py-2">
        <Text className="flex-1 text-lg font-semibold text-ink">{label}</Text>
        <Text className="text-base text-muted">{rows.length} 項</Text>
      </View>
      <View className="bg-surface">
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
            {index > 0 ? <View className="mx-3 h-px bg-line" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** One food: tap the name to swap it, the amount to change it, ✕ to remove it. */
export function FoodItem({
  name,
  amount,
  open = false,
  busy,
  onReplace,
  onAmount,
  onRemove,
  children,
}: {
  name: string;
  /** The portion as shown ("30 g"); empty for a food typed in by hand. */
  amount: string;
  /** Whether `children` are showing under the row, which also flips the amount's chevron. */
  open?: boolean;
  busy?: boolean;
  /** Without it the name is plain text. */
  onReplace?: () => void;
  /** Without it the amount is not shown. */
  onAmount?: () => void;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const label = <Text className="text-base font-semibold text-ink">{name}</Text>;

  return (
    <View>
      <View className="min-h-[60px] flex-row items-center gap-2 py-2 pl-3">
        {onReplace ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`替換${name}`}
            accessibilityState={{ disabled: Boolean(busy) }}
            disabled={busy}
            onPress={onReplace}
            className="min-h-[44px] flex-1 justify-center active:opacity-60"
          >
            {label}
          </Pressable>
        ) : (
          <View className="min-h-[44px] flex-1 justify-center">{label}</View>
        )}
        {amount && onAmount ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`調整${name}份量，目前${amount}`}
            accessibilityState={{ expanded: open, disabled: Boolean(busy) }}
            disabled={busy}
            onPress={onAmount}
            className="min-h-[44px] flex-row items-center justify-center gap-1 rounded-full bg-fill px-3 active:opacity-70"
          >
            <Text className="text-base font-semibold text-ink">{amount}</Text>
            <ChevronIcon direction={open ? 'up' : 'down'} size={14} tint={color.muted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`移除${name}`}
          accessibilityState={{ disabled: Boolean(busy) }}
          disabled={busy}
          onPress={onRemove}
          className="h-11 w-11 items-center justify-center active:opacity-60"
        >
          <CloseIcon size={18} tint={color.muted} />
        </Pressable>
      </View>
      {open && children ? <View className="gap-3 px-3 pb-3">{children}</View> : null}
    </View>
  );
}
