/** 今日流程頂端的進度列。已完成的步驟可以點回去改。 */
import { Pressable, Text, View } from 'react-native';

export const STEP_LABEL: Record<string, string> = {
  body: '量身形',
  breakfast: '早餐',
  lunch: '午餐',
  workout: '運動',
  dinner: '晚餐',
  done: '完成',
};

export function StepIndicator({
  steps,
  completed,
  current,
  onSelect,
}: {
  steps: string[];
  completed: string[];
  current: string;
  onSelect?: (step: string) => void;
}) {
  return (
    <View className="flex-row gap-1.5">
      {steps.map((step) => {
        const isDone = completed.includes(step);
        const isCurrent = step === current;
        const reachable = isDone || isCurrent;

        return (
          <Pressable
            key={step}
            accessibilityRole="button"
            accessibilityState={{ selected: isCurrent, disabled: !reachable }}
            disabled={!reachable || !onSelect}
            onPress={() => onSelect?.(step)}
            className="flex-1 gap-1.5 pb-1"
          >
            <View
              className={`h-1 rounded-full ${
                isCurrent ? 'bg-primary' : isDone ? 'bg-primary/40' : 'bg-line'
              }`}
            />
            <Text
              className={`text-center text-sm ${
                isCurrent ? 'font-semibold text-primary' : isDone ? 'text-ink' : 'text-muted'
              }`}
            >
              {STEP_LABEL[step] ?? step}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
