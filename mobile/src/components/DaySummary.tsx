/**
 * Today's header: what has been eaten against the day's targets.
 *
 * Collapsed by default, because the number that drives a decision is "how much is left";
 * the macro breakdown is something you check occasionally, not on every screen load.
 *
 * A ring rather than a pie. A pie encodes parts of a whole; this is progress toward a
 * goal and it can pass 100%, which is exactly when it most needs to be readable.
 *
 * Deliberately absent: the BMR floor and the training burn. `compute_targets` clamps the
 * target with `max(..., bmr, floor)`, so clearing the target always clears the floor —
 * two gaps pointing the same way, one of them always redundant. The burn belongs next to the
 * workout that produced it, not next to the calories, where it only invites "can I eat
 * that back?" — the activity factor has already spent it.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Schema } from '@/api/client';
import { color } from '@/theme/tokens';

type Nutrients = Schema<'NutrientsOut'>;
type Targets = Schema<'TargetsOut'>;

const RING_SIZE = 108;
const RING_WIDTH = 10;
const RADIUS = (RING_SIZE - RING_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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

function Bar({ value, target, tone }: { value: number; target: number; tone: string }) {
  return (
    // Width goes through `style`: NativeWind has no arbitrary percentage class that
    // behaves the same on native and web.
    <View className="h-1.5 overflow-hidden rounded-full bg-fill">
      <View
        className="h-full rounded-full"
        style={{ width: `${ratio(value, target) * 100}%`, backgroundColor: tone }}
      />
    </View>
  );
}

function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const stroke = eaten > target ? color.warm : color.primary;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }} className="items-center justify-center">
      <Svg
        width={RING_SIZE}
        height={RING_SIZE}
        // Start the arc at twelve o'clock instead of three.
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={color.fill}
          strokeWidth={RING_WIDTH}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={stroke}
          strokeWidth={RING_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio(eaten, target))}
          fill="none"
        />
      </Svg>
      <Text className="font-display text-2xl font-bold text-ink">
        {Math.round(eaten).toLocaleString()}
      </Text>
      <Text className="text-xs text-muted">/ {target.toLocaleString()} 大卡</Text>
    </View>
  );
}

function MacroRow({
  label,
  value,
  target,
  tone,
}: {
  label: string;
  value: number;
  target: number;
  tone: string;
}) {
  // A full bar reads as "done"; only the number can say you went past the target.
  const over = value > target;
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-xs text-muted">{label}</Text>
        <Text className={`text-xs ${over ? 'text-warm' : 'text-ink'}`}>
          {Math.round(value)}
          <Text className="text-muted">/{target} g</Text>
        </Text>
      </View>
      <Bar value={value} target={target} tone={tone} />
    </View>
  );
}

export function DaySummary({ eaten, targets }: { eaten: Nutrients; targets: Targets }) {
  const [open, setOpen] = useState(expanded);
  const kcal = Math.round(eaten.kcal);
  const remaining = targets.kcal - kcal;

  const toggle = () => {
    expanded = !open;
    setOpen(expanded);
  };

  const headline =
    remaining >= 0
      ? `還可以吃 ${remaining.toLocaleString()} 大卡`
      : `超出 ${Math.abs(remaining).toLocaleString()} 大卡`;

  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? '收起營養素細節' : '展開營養素細節'}
        onPress={toggle}
        className="min-h-[44px] justify-center gap-2"
      >
        <View className="flex-row items-baseline justify-between gap-2">
          {/* Expanded, the ring already carries the running total — repeating it here
              would just be the same two numbers twice. */}
          {open ? (
            <Text className={`text-sm ${remaining >= 0 ? 'text-muted' : 'text-warm'}`}>
              {headline}
            </Text>
          ) : (
            <Text className="text-base text-ink">
              <Text className="font-display font-bold">{kcal.toLocaleString()}</Text>
              <Text className="text-muted"> / {targets.kcal.toLocaleString()} 大卡</Text>
            </Text>
          )}
          <Text className={`text-sm ${remaining >= 0 ? 'text-muted' : 'text-warm'}`}>
            {open ? '⌃' : `${headline} ⌄`}
          </Text>
        </View>
        {open ? null : (
          <Bar value={kcal} target={targets.kcal} tone={remaining >= 0 ? color.primary : color.warm} />
        )}
      </Pressable>

      {open ? (
        <View className="flex-row items-center gap-4">
          <CalorieRing eaten={kcal} target={targets.kcal} />

          <View className="flex-1 gap-2">
            <MacroRow
              label="蛋白質"
              value={eaten.protein_g}
              target={targets.protein_g}
              tone={color.good}
            />
            <MacroRow label="脂肪" value={eaten.fat_g} target={targets.fat_g} tone={color.warm} />
            <MacroRow
              label="碳水"
              value={eaten.carb_g}
              target={targets.carb_g}
              tone={color.primary}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
