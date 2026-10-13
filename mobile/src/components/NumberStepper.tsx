/** A small - N + control for short ranges, such as the set count on the template editor. */
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { useI18n } from '@/i18n/runtime';

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
  const { t } = useI18n();
  const move = (direction: 1 | -1) =>
    onChange(Math.min(max, Math.max(min, value + direction * step)));

  return (
    <View className="flex-row items-center rounded-field border-[1.5px] border-edge bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.accessibility.decreaseNamed', { name: '' }).trim()}
        onPress={() => move(-1)}
        disabled={value <= min}
        className="min-h-[44px] w-11 items-center justify-center"
      >
        <Text className={`text-xl ${value <= min ? 'text-disabled' : 'text-ink'}`}>−</Text>
      </Pressable>
      <Text className="min-w-[32px] text-center text-base text-ink">
        {format(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.accessibility.increaseNamed', { name: '' }).trim()}
        onPress={() => move(1)}
        disabled={value >= max}
        className="min-h-[44px] w-11 items-center justify-center"
      >
        <Text className={`text-xl ${value >= max ? 'text-disabled' : 'text-ink'}`}>+</Text>
      </Pressable>
    </View>
  );
}
