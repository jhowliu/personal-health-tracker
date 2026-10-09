/**
 * Today's header: how much is left to eat, against a target that may include the workout.
 *
 * How much is left leads the card, since it is what the next meal is decided by; what was eaten
 * and the full target sit under it in one line. On a workout day a badge says how much of the
 * target the workout added — the half of its burn handed back
 * (see compute_targets), not the burn itself, which the workout screen shows.
 *
 * Collapsed by default: the macro breakdown is something you check occasionally, not on every
 * screen load. Expanded, it opens in the same card as three columns, then how the target is
 * made up when a workout added to it.
 *
 * Deliberately absent: the BMR floor. `compute_targets` clamps the target with
 * `max(..., bmr, floor)`, so clearing the target always clears the floor — two gaps pointing
 * the same way, one of them always redundant.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ChevronIcon, RunIcon } from '@/components/icons';
import { Text } from '@/components/text';
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
    <View className={`${thin ? 'h-[5px]' : 'h-[7px]'} overflow-hidden rounded-lg bg-surface`}>
      <View className="h-full rounded-lg" style={{ width: `${ratio(value, target) * 100}%`, backgroundColor: tone }} />
    </View>
  );
}

function MacroColumn({ label, value, target, tone }: { label: string; value: number; target: number; tone: string }) {
  // A full bar reads as "done"; only the number's colour says you went past the target.
  const eaten = Math.round(value);
  const over = eaten > target;
  return (
    <View className="flex-1 gap-1">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={`text-[20px] ${over ? 'text-warm' : 'text-ink'}`}>
        {eaten}
        <Text className="text-xs text-muted"> / {target} g</Text>
      </Text>
      <Bar value={value} target={target} tone={over ? color.warmFill : tone} thin />
    </View>
  );
}

export function DaySummary({
  eaten,
  targets,
}: {
  eaten: Nutrients;
  targets: Targets;
}) {
  const [open, setOpen] = useState(expanded);
  const kcal = Math.round(eaten.kcal);
  const remaining = targets.kcal - kcal;
  const over = remaining < 0;
  const added = targets.exercise_kcal;
  const addedLabel = '訓練加回';

  const toggle = () => {
    expanded = !open;
    setOpen(expanded);
  };

  const spoken = `${over ? '超出' : '還可以吃'} ${Math.abs(remaining).toLocaleString()} 大卡，已吃 ${kcal.toLocaleString()}，目標 ${targets.kcal.toLocaleString()} 大卡${
    added > 0 ? `，含${addedLabel} ${added.toLocaleString()}` : ''
  }`;

  return (
    <View className="gap-3 rounded-[18px] border-[2.5px] border-edge bg-warm-soft px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spoken}
        accessibilityHint={open ? '收起營養素細節' : '展開營養素細節'}
        onPress={toggle}
        className="gap-3"
      >
        <View className="flex-row items-center justify-between">
          <Text className={`text-sm ${over ? 'text-warm' : 'text-ink'}`}>{over ? '超出目標' : '還可以吃'}</Text>
          <View className="flex-row items-center gap-1.5">
            <Text className={`text-[22px] ${over ? 'text-warm' : 'text-ink'}`}>
              {Math.abs(remaining).toLocaleString()}
              <Text className="text-xs text-muted"> 大卡</Text>
            </Text>
            <ChevronIcon direction={open ? 'up' : 'down'} size={16} tint={color.ink} />
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-xs text-muted">
            已吃 {kcal.toLocaleString()} / {targets.kcal.toLocaleString()} 大卡
          </Text>
          {added > 0 ? (
            <View className="flex-row items-center gap-2 rounded-control bg-primary-soft px-3 py-1.5">
              <RunIcon size={17} tint={color.primary} />
              <View>
                <Text className="text-xs text-primary">{addedLabel}</Text>
                <Text className="text-sm text-primary">+{added.toLocaleString()} 大卡</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Bar value={kcal} target={targets.kcal} tone={over ? color.warmFill : color.primary} />
      </Pressable>

      {open ? (
        <View className="gap-3 border-t border-line pt-3">
          <View className="flex-row gap-4">
            <MacroColumn label="蛋白質" value={eaten.protein_g} target={targets.protein_g} tone={color.good} />
            <MacroColumn label="脂肪" value={eaten.fat_g} target={targets.fat_g} tone={color.warmFill} />
            <MacroColumn label="碳水" value={eaten.carb_g} target={targets.carb_g} tone={color.primary} />
          </View>
          {added > 0 ? (
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted">原目標 {targets.base_kcal.toLocaleString()} 大卡</Text>
              <Text className="text-xs text-muted">+ 訓練 {added.toLocaleString()} 大卡</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
