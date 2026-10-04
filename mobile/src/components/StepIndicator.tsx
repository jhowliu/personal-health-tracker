/**
 * The progress track at the top of today's flow. Every step can be tapped: the order is a
 * suggestion, and a workout done after breakfast should not wait for lunch to be logged.
 */
import { Pressable, Text, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { color } from '@/theme/tokens';

export const STEP_LABEL: Record<string, string> = {
  body: '量身形',
  breakfast: '早餐',
  lunch: '午餐',
  workout: '訓練',
  dinner: '晚餐',
  done: '完成',
};

/**
 * One dot on the track. State is never colour alone: a check for done, a dash for skipped, a
 * ring for the step on screen, a dark outline for the next open step, a plain grey disc for
 * the rest.
 */
function StepNode({
  done,
  skipped,
  viewing,
  next,
}: {
  done: boolean;
  skipped: boolean;
  viewing: boolean;
  next: boolean;
}) {
  const disc = skipped
    ? 'border border-line bg-fill'
    : done
    ? 'bg-good'
    : viewing
      ? 'bg-primary'
      : next
        ? 'border-2 border-ink bg-surface'
        : 'border border-line bg-fill';

  return (
    <View
      className={`h-7 w-7 items-center justify-center rounded-full ${
        viewing ? 'border-2 border-primary' : ''
      }`}
    >
      <View className={`h-5 w-5 items-center justify-center rounded-full ${disc}`}>
        {skipped ? (
          <View className="h-0.5 w-2.5 rounded-full bg-muted" />
        ) : done ? (
          <CheckIcon size={12} tint={color.surface} />
        ) : viewing ? (
          <View className="h-2 w-2 rounded-full bg-surface" />
        ) : null}
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
        // The track between two dots is filled once the step on its left is finished.
        const leftFilled = index > 0 && completed.includes(steps[index - 1]);
        const rightFilled = isDone;

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
              <View
                className={`mr-1 h-0.5 flex-1 ${
                  index === 0 ? '' : leftFilled ? 'bg-good' : 'bg-line'
                }`}
              />
              <StepNode done={isDone} skipped={isSkipped} viewing={isCurrent} next={isNext} />
              <View
                className={`ml-1 h-0.5 flex-1 ${
                  index === steps.length - 1 ? '' : rightFilled ? 'bg-good' : 'bg-line'
                }`}
              />
            </View>
            <Text
              className={`text-center text-sm ${
                isCurrent
                  ? 'font-semibold text-primary'
                  : (isDone && !isSkipped) || isNext
                    ? 'text-ink'
                    : 'text-muted'
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
