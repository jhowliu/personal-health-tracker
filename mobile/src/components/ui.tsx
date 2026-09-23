/** 畫面共用的基礎元件。樣式集中在這裡,個別畫面不再重寫一次卡片與按鈕。 */
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 pb-8 pt-2 gap-4"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5 pb-8 pt-2">{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View className="gap-1">
      <Text className="font-display text-3xl font-bold text-ink">{children}</Text>
      {sub ? <Text className="text-base text-muted">{sub}</Text> : null}
    </View>
  );
}

export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-display text-xl font-bold text-ink">{children}</Text>
      {action}
    </View>
  );
}

export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`rounded-card border border-line bg-surface p-4 ${className}`} {...props} />
  );
}

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between border-b border-line py-3 last:border-b-0">
      <Text className="text-base text-ink">{label}</Text>
      {typeof value === 'string' ? <Text className="text-base text-muted">{value}</Text> : value}
    </View>
  );
}

export function Field({
  label,
  suffix,
  className = '',
  ...props
}: TextInputProps & { label?: string; suffix?: string; className?: string }) {
  return (
    <View className="flex-1 gap-1">
      {label ? <Text className="text-sm text-muted">{label}</Text> : null}
      <View className="flex-row items-center rounded-field border border-line bg-surface px-3">
        <TextInput
          className={`min-h-[44px] flex-1 text-base text-ink ${className}`}
          placeholderTextColor="#9C9599"
          {...props}
        />
        {suffix ? <Text className="pl-2 text-sm text-muted">{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
  tone = 'primary',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'dark' | 'plain';
}) {
  const skin = {
    primary: 'bg-primary',
    dark: 'bg-ink',
    plain: 'border border-line bg-surface',
  }[tone];
  const label = tone === 'plain' ? 'text-ink' : 'text-white';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      className={`min-h-[52px] items-center justify-center rounded-field ${skin} ${
        disabled ? 'opacity-40' : 'active:opacity-80'
      }`}
    >
      <Text className={`text-base font-semibold ${label}`}>{children}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'dark',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'dark' | 'soft';
}) {
  return (
    <View className={`flex-row rounded-full ${tone === 'soft' ? 'bg-fill' : ''} p-1`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={`min-h-[44px] flex-1 items-center justify-center rounded-full ${
              active ? 'bg-ink' : ''
            }`}
          >
            <Text className={`text-base ${active ? 'font-semibold text-white' : 'text-muted'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'neutral' | 'primary' | 'good' | 'warm';
}) {
  const skin = selected
    ? 'bg-ink'
    : { neutral: 'bg-fill', primary: 'bg-primary-soft', good: 'bg-good-soft', warm: 'bg-warm-soft' }[
        tone
      ];
  const label_ = selected
    ? 'text-white'
    : { neutral: 'text-muted', primary: 'text-primary', good: 'text-good', warm: 'text-warm' }[tone];

  const content = (
    <View className={`rounded-full px-3 py-1.5 ${skin}`}>
      <Text className={`text-sm ${label_}`}>{label}</Text>
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className="min-h-[44px] justify-center">
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-muted">{children}</Text>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <View className="items-center gap-2 py-12">
      <Text className="text-center text-base text-muted">{children}</Text>
    </View>
  );
}
