/** The time zone control on the settings screen: the current zone, and a dropdown list to switch it. */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Hint } from '@/components/ui';
import { COMMON_TIMEZONES, deviceTimezone, timezoneLabel } from '@/timezone';

export function TimezoneRow({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const device = deviceTimezone();

  const choose = async (id: string) => {
    setOpen(false);
    if (id !== value) await onSave(id);
  };

  // The phone's own zone leads the list, so travelling is one tap. The current zone always
  // appears, even when it is outside the short list, so the dropdown shows what is selected.
  const options = [
    { id: device, label: '這支手機的時區' },
    ...COMMON_TIMEZONES.filter((zone) => zone.id !== device),
  ];
  if (!options.some((zone) => zone.id === value)) {
    options.unshift({ id: value, label: timezoneLabel(value) });
  }

  return (
    <View className="py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更改時區"
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-row items-center justify-between"
      >
        <View className="flex-1 gap-0.5 pr-4">
          <Text className="text-base text-ink">時區</Text>
          <Hint>決定「今天」從哪一刻算起。提醒按手機目前的時區響。</Hint>
        </View>
        <Text className="text-base text-muted">{timezoneLabel(value)} ▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessible={false}
          onPress={() => setOpen(false)}
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(35, 31, 32, 0.35)' }}
        >
          <SafeAreaView edges={['bottom']} className="max-h-[75%] rounded-t-card bg-bg px-5 pb-3 pt-5">
            <Pressable accessible={false} onPress={(event) => event.stopPropagation()} className="gap-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text accessibilityRole="header" className="font-display text-2xl font-bold text-ink">
                  時區
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOpen(false)}
                  className="min-h-[44px] justify-center px-2"
                >
                  <Text className="text-base text-primary">關閉</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerClassName="gap-2 pb-4">
                {options.map((zone) => {
                  const selected = zone.id === value;
                  return (
                    <Pressable
                      key={zone.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => choose(zone.id)}
                      className={`min-h-[44px] flex-row items-center justify-between gap-3 rounded-field px-3 py-2 ${
                        selected ? 'bg-primary-soft' : 'bg-fill'
                      }`}
                    >
                      <View className="flex-1 gap-0.5">
                        <Text className="text-base text-ink">{zone.label}</Text>
                        <Text className="text-sm text-muted">{zone.id}</Text>
                      </View>
                      {selected ? <Text className="text-base text-primary">✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}
