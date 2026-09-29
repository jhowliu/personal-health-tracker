/** The time zone control on the settings screen: the current zone and a short list to switch to. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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

  // The phone's own zone leads the list, so travelling is one tap.
  const options = [
    ...(device !== value ? [{ id: device, label: `這支手機的時區` }] : []),
    ...COMMON_TIMEZONES.filter((zone) => zone.id !== value && zone.id !== device),
  ];

  return (
    <View className="gap-2 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更改時區"
        onPress={() => setOpen((current) => !current)}
        className="min-h-[44px] flex-row items-center justify-between"
      >
        <View className="flex-1 gap-0.5 pr-4">
          <Text className="text-base text-ink">時區</Text>
          <Hint>決定「今天」從哪一刻算起。提醒按手機目前的時區響。</Hint>
        </View>
        <Text className="text-base text-muted">{timezoneLabel(value)}</Text>
      </Pressable>
      {open
        ? options.map((zone) => (
            <Pressable
              key={zone.id}
              accessibilityRole="button"
              onPress={() => choose(zone.id)}
              className="min-h-[44px] flex-row items-center justify-between rounded-field border border-line bg-surface px-3"
            >
              <Text className="text-base text-ink">{zone.label}</Text>
              <Text className="text-sm text-muted">{zone.id}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}
