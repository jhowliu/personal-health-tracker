/**
 * The 完成 bar that sits above iOS numeric keypads.
 *
 * Rendered once from the root layout, not per screen: nativeID has to be unique, and
 * tab screens stay mounted, so one per Screen would leave several claiming the same id.
 *
 * Android is a no-op — its numeric keyboard has a system back button.
 */
import { InputAccessoryView, Keyboard, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { NUMERIC_ACCESSORY_ID } from '@/components/ui';

export function NumericDoneBar() {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_ACCESSORY_ID}>
      <View className="flex-row justify-end border-t border-line bg-bg px-4 py-2">
        <Pressable
          accessibilityRole="button"
          onPress={Keyboard.dismiss}
          className="min-h-[44px] justify-center px-4"
        >
          <Text className="text-base text-primary">完成</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
