/**
 * Web stand-in for react-native's Alert. react-native-web's Alert.alert does nothing, so error
 * messages vanish and anything behind a confirm (移除, 刪除, 放棄) can never happen. Calls queue
 * here, and AlertHost draws them one at a time inside the phone frame.
 */
import { useSyncExternalStore } from 'react';
import { View, type AlertButton } from 'react-native';

import { AppModal } from '@/components/AppModal';
import { Text } from '@/components/text';
import { PrimaryButton } from '@/components/ui';

type Dialog = { title: string; message?: string; buttons: AlertButton[] };

const queue: Dialog[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function current() {
  return queue[0] ?? null;
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: '好' }] });
    notify();
  },
};

/** Mounted once inside the phone frame, from the root layout. */
export function AlertHost() {
  const dialog = useSyncExternalStore(subscribe, current, current);
  if (!dialog) return null;

  const press = (button: AlertButton) => {
    queue.shift();
    notify();
    void button.onPress?.();
  };
  // Escape answers like the native back button would: cancel, or the only way out.
  const escape =
    dialog.buttons.find((button) => button.style === 'cancel') ??
    (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined);
  const defaults = dialog.buttons.filter((button) => !button.style || button.style === 'default');
  const stacked = dialog.buttons.length > 2;

  return (
    <AppModal visible transparent onRequestClose={escape ? () => press(escape) : undefined}>
      <View className="flex-1 items-center justify-center bg-scrim px-8">
        <View accessibilityRole="alert" className="w-full max-w-[320px] gap-4 rounded-sheet border-2 border-edge bg-bg p-5">
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="text-lg text-ink">
              {dialog.title}
            </Text>
            {dialog.message ? <Text className="text-base text-muted">{dialog.message}</Text> : null}
          </View>
          <View className={stacked ? 'gap-2' : 'flex-row gap-2'}>
            {dialog.buttons.map((button, index) => (
              <View key={`${index}-${button.text}`} className={stacked ? '' : 'flex-1'}>
                <PrimaryButton
                  onPress={() => press(button)}
                  tone={
                    button.style === 'destructive'
                      ? 'danger'
                      : button.style === 'cancel' || defaults.length > 1
                        ? 'plain'
                        : 'primary'
                  }
                >
                  {button.text ?? '好'}
                </PrimaryButton>
              </View>
            ))}
          </View>
        </View>
      </View>
    </AppModal>
  );
}
