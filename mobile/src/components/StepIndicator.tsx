/**
 * The progress track at the top of today's flow. Every step can be tapped: the order is a
 * suggestion, and a workout done after breakfast should not wait for lunch to be logged.
 */
import { Pressable, View } from 'react-native';

import { CheckIcon, DumbbellIcon, ScaleIcon, UtensilsIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { color } from '@/theme/tokens';

export const STEP_LABEL: Record<string, string> = {
  body: '量身形',
  breakfast: '早餐',
  lunch: '午餐',
  workout: '訓練',
  dinner: '晚餐',
  done: '完成',
};

const STEP_ICON: Record<string, typeof CheckIcon> = {
  body: ScaleIcon,
  breakfast: UtensilsIcon,
  lunch: UtensilsIcon,
  workout: DumbbellIcon,
  dinner: UtensilsIcon,
};

/**
 * One circle on the track. State is never colour alone: a check for done, a dash for skipped,
 * the step's own icon while it is still open, and a berry outline with a soft ring for the
 * step on screen.
 */
function StepNode({
  step,
  done,
  skipped,
  viewing,
}: {
  step: string;
  done: boolean;
  skipped: boolean;
  viewing: boolean;
}) {
  const Glyph = STEP_ICON[step] ?? UtensilsIcon;
  const fill = skipped ? 'bg-warm-soft' : done ? 'bg-good-soft' : 'bg-bg';

  return (
    <View
      className={`h-[42px] w-[42px] items-center justify-center rounded-full ${viewing ? 'bg-primary-soft' : ''}`}
    >
      <View
        className={`h-[34px] w-[34px] items-center justify-center rounded-full border-2 ${
          viewing ? 'border-primary' : 'border-edge'
        } ${fill}`}
      >
        {skipped ? (
          <View className="h-0.5 w-3 rounded-full bg-warm" />
        ) : done ? (
          <CheckIcon size={15} tint={viewing ? color.primary : color.good} />
        ) : (
          <Glyph size={15} tint={viewing ? color.primary : color.ink} />
        )}
      </View>
    </View>
  );
}

export function StepIndicator({
  steps,
  completed,
  skipped = [],
  current,
  next,
  onSelect,
}: {
  steps: string[];
  completed: string[];
  /** Completed steps that were skipped rather than done. */
  skipped?: string[];
  /** The step on screen. It is not always the next open one: a finished step can be revisited. */
  current: string;
  /** The first step still open, marked so it stands out while another step is on screen. */
  next?: string;
  onSelect?: (step: string) => void;
}) {
  return (
    <View className="flex-row">
      {steps.map((step, index) => {
        const isDone = completed.includes(step);
        const isSkipped = isDone && skipped.includes(step);
        const isCurrent = step === current;
        const isNext = step === next;
        const name = STEP_LABEL[step] ?? step;

        return (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityLabel={`${name}，第 ${index + 1} 步，共 ${steps.length} 步，${
              isSkipped ? '已略過' : isDone ? '已完成' : '未完成'
            }${isCurrent ? '，目前顯示' : ''}`}
            accessibilityState={{ selected: isCurrent }}
            disabled={!onSelect}
            onPress={() => onSelect?.(step)}
            className="flex-1 items-center gap-1"
          >
            <View className="w-full flex-row items-center">
              <View className={`h-[1.5px] flex-1 ${index === 0 ? '' : 'bg-good/40'}`} />
              <StepNode step={step} done={isDone} skipped={isSkipped} viewing={isCurrent} />
              <View className={`h-[1.5px] flex-1 ${index === steps.length - 1 ? '' : 'bg-good/40'}`} />
            </View>
            <Text
              className={`rounded-full px-2 text-center text-xs ${
                isCurrent ? 'bg-primary-soft text-primary' : isNext || isDone ? 'text-ink' : 'text-muted'
              }`}
            >
              {name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
