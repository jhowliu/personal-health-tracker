/** The time zone control on the settings screen: the current zone, and a dropdown list to switch it. */
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ChoiceOption, Sheet } from '@/components/Sheet';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { color } from '@/theme/tokens';
import { LabelWithTip } from '@/components/ui';
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
    <View className="flex-row items-center justify-between gap-3 py-3">
      {/* Two sibling controls: a button cannot contain the (i) button of the label. */}
      <LabelWithTip label="時區" tip="決定「今天」從哪一刻算起。提醒按手機目前的時區響。" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更改時區"
        onPress={() => setOpen(true)}
        className="min-h-[44px] flex-1 flex-row items-center justify-end gap-1"
      >
        <Text className="shrink text-base text-muted">{timezoneLabel(value)}</Text>
        <ChevronIcon direction="right" size={16} tint={color.muted} />
      </Pressable>
      <Sheet visible={open} title="時區" onClose={() => setOpen(false)}>
        <ScrollView contentContainerClassName="gap-2 pb-4">
          {options.map((zone) => (
            <ChoiceOption
              key={zone.id}
              label={zone.label}
              detail={zone.id}
              selected={zone.id === value}
              onPress={() => choose(zone.id)}
            />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
