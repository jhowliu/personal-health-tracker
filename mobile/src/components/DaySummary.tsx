/**
 * Today's header: how much is left to eat, against a target that may include the workout.
 *
 * The number that drives a decision is "how much is left", so it leads in large type; what
 * was eaten and the full target sit under it. On a workout day a chip says how much of the
 * target the workout added — the half of its burn handed back (see compute_targets), not the
 * burn itself, which the workout screen shows.
 *
 * Collapsed by default: the macro breakdown is something you check occasionally, not on every
 * screen load. Expanded, it opens in the same card as three columns. There is no ring: it
 * would only repeat the headline.
 *
 * Deliberately absent: the BMR floor. `compute_targets` clamps the target with
 * `max(..., bmr, floor)`, so clearing the target always clears the floor — two gaps pointing
 * the same way, one of them always redundant.
 */
import { type ComponentType, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { BowlIcon, ChevronIcon, DropletIcon, ProteinIcon, RunIcon } from '@/components/icons';
import { color } from '@/theme/tokens';

type Nutrients = Schema<'NutrientsOut'>;
type Targets = Schema<'TargetsOut'>;

/**
 * Remembered for as long as the app is running. The tab screen unmounts when you move
 * away from it, and a `useState` default would silently re-collapse every time. Storing
 * it properly would mean a new dependency or a profile column, which is more machinery
 * than a disclosure toggle is worth.
 */
let expanded = false;

function ratio(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

function Bar({ value, target, tone, thin }: { value: number; target: number; tone: string; thin?: boolean }) {
  return (
    // Width goes through `style`: NativeWind has no arbitrary percentage class that
    // behaves the same on native and web.
    <View className={`${thin ? 'h-1.5' : 'h-2.5'} overflow-hidden rounded-full bg-fill`}>
      <View
        className="h-full rounded-full"
        style={{ width: `${ratio(value, target) * 100}%`, backgroundColor: tone }}
      />
    </View>
  );
}

function MacroColumn({
  label,
  value,
  target,
  tone,
  soft,
  icon: Icon,
}: {
  label: string;
  value: number;
  target: number;
  tone: string;
  soft: string;
  icon: ComponentType<{ size?: number; tint?: string }>;
}) {
  // A full bar reads as "done"; only the number can say you went past the target.
  const over = value > target;
  return (
    <View className="flex-1 gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: soft }}>
          <Icon size={14} tint={tone} />
        </View>
        <Text className="text-sm text-muted">{label}</Text>
      </View>
      <Text className="text-sm text-muted">
        <Text className={`text-base font-bold ${over ? 'text-warm' : 'text-ink'}`}>{Math.round(value)} g</Text> /{' '}
        {target} g
      </Text>
      <Bar value={value} target={target} tone={over ? color.warm : tone} thin />
    </View>
  );
}

export function DaySummary({ eaten, targets }: { eaten: Nutrients; targets: Targets }) {
  const [open, setOpen] = useState(expanded);
  const kcal = Math.round(eaten.kcal);
  const remaining = targets.kcal - kcal;
  const over = remaining < 0;
  const added = targets.exercise_kcal;

  const toggle = () => {
    expanded = !open;
    setOpen(expanded);
  };

  const spoken = `${over ? '超出' : '還可以吃'} ${Math.abs(remaining).toLocaleString()} 大卡，已吃 ${kcal.toLocaleString()}，目標 ${targets.kcal.toLocaleString()} 大卡${
    added > 0 ? `，含訓練加回 ${added.toLocaleString()}` : ''
  }`;

  return (
    <View className="gap-4 rounded-card border border-line bg-surface p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spoken}
        accessibilityHint={open ? '收起營養素細節' : '展開營養素細節'}
        onPress={toggle}
        className="gap-3"
      >
        <View className="flex-row items-center justify-between">
          <Text className={`text-base ${over ? 'text-warm' : 'text-muted'}`}>{over ? '超出' : '還可以吃'}</Text>
          <ChevronIcon direction={open ? 'up' : 'down'} size={18} tint={color.muted} />
        </View>

        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className={`font-display text-4xl font-bold ${over ? 'text-warm' : 'text-ink'}`}>
              {Math.abs(remaining).toLocaleString()}
              <Text className="text-lg font-normal"> 大卡</Text>
            </Text>
            <Text className="text-sm text-muted">
              已吃 {kcal.toLocaleString()} / {targets.kcal.toLocaleString()} 大卡
            </Text>
          </View>
          {added > 0 ? (
            <View className="flex-row items-center gap-2 rounded-field bg-primary-soft px-3 py-2">
              <RunIcon size={20} tint={color.primary} />
              <View>
                <Text className="text-xs text-muted">訓練加回</Text>
                <Text className="text-sm font-bold text-primary">+{added.toLocaleString()} 大卡</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Bar value={kcal} target={targets.kcal} tone={over ? color.warm : color.primary} />
      </Pressable>

      {open ? (
        <View className="flex-row gap-4 border-t border-line pt-3">
          <MacroColumn
            label="蛋白質"
            value={eaten.protein_g}
            target={targets.protein_g}
            tone={color.good}
            soft={color.goodSoft}
            icon={ProteinIcon}
          />
          <MacroColumn
            label="脂肪"
            value={eaten.fat_g}
            target={targets.fat_g}
            tone={color.warm}
            soft={color.warmSoft}
            icon={DropletIcon}
          />
          <MacroColumn
            label="碳水"
            value={eaten.carb_g}
            target={targets.carb_g}
            tone={color.primary}
            soft={color.primarySoft}
            icon={BowlIcon}
          />
        </View>
      ) : null}
    </View>
  );
}
