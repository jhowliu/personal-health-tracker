/** A small - N + control: the set count on the template editor, the hour and minute of a reminder. */
import { Pressable, Text, View } from 'react-native';

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  format = String,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** How much one tap moves the value. */
  step?: number;
  format?: (value: number) => string;
}) {
  const move = (direction: 1 | -1) =>
    onChange(Math.min(max, Math.max(min, value + direction * step)));

  return (
    <View className="flex-row items-center rounded-field border border-line bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="減少"
        onPress={() => move(-1)}
        disabled={value <= min}
        className={`min-h-[44px] w-11 items-center justify-center ${value <= min ? 'opacity-30' : ''}`}
      >
        <Text className="text-xl text-ink">−</Text>
      </Pressable>
      <Text className="min-w-[32px] text-center text-base font-semibold text-ink">
        {format(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="增加"
        onPress={() => move(1)}
        disabled={value >= max}
        className={`min-h-[44px] w-11 items-center justify-center ${value >= max ? 'opacity-30' : ''}`}
      >
        <Text className="text-xl text-ink">+</Text>
      </Pressable>
    </View>
  );
}
