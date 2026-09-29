/** Generated category artwork used wherever a food photo would otherwise appear. */
import type { ComponentType } from 'react';
import { View } from 'react-native';

import {
  BowlIcon,
  DropletIcon,
  FruitIcon,
  LeafIcon,
  ProteinIcon,
  UtensilsIcon,
} from '@/components/icons';
import { color, foodCategoryTone } from '@/theme/tokens';

type Glyph = ComponentType<{ size?: number; tint?: string }>;
type IconSize = 'sm' | 'md' | 'lg';

const CATEGORY_ICON: Record<string, Glyph> = {
  staple: BowlIcon,
  protein: ProteinIcon,
  vegetable: LeafIcon,
  fruit: FruitIcon,
  fat_sauce: DropletIcon,
};

const SIZE = {
  sm: { box: 32, glyph: 18 },
  md: { box: 40, glyph: 22 },
  lg: { box: 52, glyph: 26 },
} as const;

export function FoodCategoryIcon({
  category,
  size = 'md',
  solid = false,
}: {
  category: string | null | undefined;
  size?: IconSize;
  solid?: boolean;
}) {
  const Glyph = CATEGORY_ICON[category ?? ''] ?? UtensilsIcon;
  const tone = foodCategoryTone(category);
  const dimensions = SIZE[size];

  return (
    <View
      aria-hidden
      style={{
        width: dimensions.box,
        height: dimensions.box,
        borderRadius: dimensions.box / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? tone.accent : tone.soft,
      }}
    >
      <Glyph size={dimensions.glyph} tint={solid ? color.surface : tone.accent} />
    </View>
  );
}
