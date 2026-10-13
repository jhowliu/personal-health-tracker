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
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
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
  const { t } = useI18n();
  const [open, setOpen] = useState(expanded);
  const kcal = Math.round(eaten.kcal);
  const remaining = targets.kcal - kcal;
  const over = remaining < 0;
  const added = targets.exercise_kcal;
  const addedLabel = t('daySummary.workoutAdded');

  const toggle = () => {
    expanded = !open;
    setOpen(expanded);
  };

  const spoken = t('daySummary.spoken', {
    status: over ? t('daySummary.over') : t('daySummary.remaining'),
    remaining: formatNumber(Math.abs(remaining)),
    eaten: formatNumber(kcal),
    target: formatNumber(targets.kcal),
    workout: added > 0 ? t('daySummary.spokenWorkout', { calories: formatNumber(added) }) : '',
  });

  return (
    <View className="gap-3 rounded-[18px] border-[2.5px] border-edge bg-warm-soft px-4 py-3.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spoken}
        accessibilityHint={open ? t('daySummary.collapseNutrients') : t('daySummary.expandNutrients')}
        onPress={toggle}
        className="gap-3"
      >
        <View className="flex-row items-center justify-between">
          <Text className={`text-sm ${over ? 'text-warm' : 'text-ink'}`}>
            {over ? t('daySummary.overTarget') : t('daySummary.remaining')}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text className={`text-[22px] ${over ? 'text-warm' : 'text-ink'}`}>
              {formatNumber(Math.abs(remaining))}
              <Text className="text-xs text-muted"> {t('common.units.kcal')}</Text>
            </Text>
            <ChevronIcon direction={open ? 'up' : 'down'} size={16} tint={color.ink} />
          </View>
        </View>

        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-xs text-muted">
            {t('daySummary.eatenTarget', {
              eaten: formatNumber(kcal),
              target: formatNumber(targets.kcal),
            })}
          </Text>
          {added > 0 ? (
            <View className="flex-row items-center gap-2 rounded-control bg-primary-soft px-3 py-1.5">
              <RunIcon size={17} tint={color.primary} />
              <View>
                <Text className="text-xs text-primary">{addedLabel}</Text>
                <Text className="text-sm text-primary">+{formatNumber(added)} {t('common.units.kcal')}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Bar value={kcal} target={targets.kcal} tone={over ? color.warmFill : color.primary} />
      </Pressable>

      {open ? (
        <View className="gap-3 border-t border-line pt-3">
          <View className="flex-row gap-4">
            <MacroColumn label={t('common.labels.protein')} value={eaten.protein_g} target={targets.protein_g} tone={color.good} />
            <MacroColumn label={t('common.labels.fat')} value={eaten.fat_g} target={targets.fat_g} tone={color.warmFill} />
            <MacroColumn label={t('common.labels.carbs')} value={eaten.carb_g} target={targets.carb_g} tone={color.primary} />
          </View>
          {added > 0 ? (
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted">
                {t('daySummary.originalTarget', { calories: formatNumber(targets.base_kcal) })}
              </Text>
              <Text className="text-xs text-muted">
                {t('daySummary.workoutCalories', { calories: formatNumber(added) })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
