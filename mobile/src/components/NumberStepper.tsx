/** 編輯課表的「組數」用:− N +。 */
import { Pressable, Text, View } from 'react-native';

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <View className="flex-row items-center rounded-field border border-line bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="減少"
        onPress={() => step(-1)}
        disabled={value <= min}
        className={`min-h-[44px] w-11 items-center justify-center ${value <= min ? 'opacity-30' : ''}`}
      >
        <Text className="text-xl text-ink">−</Text>
      </Pressable>
      <Text className="min-w-[32px] text-center text-base font-semibold text-ink">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="增加"
        onPress={() => step(1)}
        disabled={value >= max}
        className={`min-h-[44px] w-11 items-center justify-center ${value >= max ? 'opacity-30' : ''}`}
      >
        <Text className="text-xl text-ink">+</Text>
      </Pressable>
    </View>
  );
}
