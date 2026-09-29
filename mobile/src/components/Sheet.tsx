/** Bottom sheet and the selectable lines that go in it. */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** One selectable line in a sheet's list; the selected one is tinted and checked. */
export function ChoiceOption({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-between gap-3 rounded-field px-3 py-2 ${
        selected ? 'bg-primary-soft' : 'bg-fill'
      }`}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-ink">{label}</Text>
        {detail ? <Text className="text-sm text-muted">{detail}</Text> : null}
      </View>
      {selected ? <Text className="text-base text-primary">✓</Text> : null}
    </Pressable>
  );
}

/** A bottom sheet: dimmed backdrop, a title with a close button, and the content below. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Lifts the sheet above the keyboard when the content has a text field. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable
          accessible={false}
          onPress={onClose}
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(35, 31, 32, 0.35)' }}
        >
          <SafeAreaView edges={['bottom']} className="max-h-[75%] rounded-t-card bg-bg px-5 pb-3 pt-5">
            <Pressable accessible={false} onPress={(event) => event.stopPropagation()} className="gap-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text accessibilityRole="header" className="font-display text-2xl font-bold text-ink">
                  {title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onClose}
                  className="min-h-[44px] justify-center px-2"
                >
                  <Text className="text-base text-primary">關閉</Text>
                </Pressable>
              </View>
              {children}
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
