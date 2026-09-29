/** The morning weigh-in reminder control on the settings screen: a switch and a time. */
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { ChevronIcon } from '@/components/icons';
import { LabelWithTip } from '@/components/ui';
import { formatReminderTime, parseReminderTime } from '@/notifications/reminder-plan';
import { color } from '@/theme/tokens';

const DEFAULT_TIME = '07:30';
/** Wait for the user to stop tapping before saving, so one adjustment is one request. */
const SAVE_DELAY_MS = 600;

export function ReminderRow({
  value,
  onSave,
}: {
  /** "HH:MM", or null when the reminder is off. */
  value: string | null;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(value);
  const saved = useRef(value);
  const save = useEffectEvent((next: string | null) => onSave(next));

  // Follow the account when it changes underneath us (another phone, a reload).
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  useEffect(() => {
    saved.current = value;
  }, [value]);

  useEffect(() => {
    if (draft === saved.current) return;
    const timer = setTimeout(() => {
      saved.current = draft;
      void save(draft);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  const time = parseReminderTime(draft ?? DEFAULT_TIME) ?? { hour: 7, minute: 30 };
  // The picker works in Dates; only the time of day matters here.
  const pickerValue = new Date();
  pickerValue.setHours(time.hour, time.minute, 0, 0);

  const pick = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'set' && picked) {
      setDraft(formatReminderTime(picked.getHours(), picked.getMinutes()));
    }
  };

  // Android shows its own clock dialog; iOS gets the wheel in a sheet.
  const edit = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: pickerValue, mode: 'time', is24Hour: true, onChange: pick });
    } else {
      setOpen(true);
    }
  };

  return (
    <View className="py-3">
      <View className="flex-row items-center justify-between">
        <LabelWithTip label="早上提醒量體重" tip="今天已經量過，就不會再提醒。" />
        <Switch
          value={draft !== null}
          onValueChange={(on) => setDraft(on ? DEFAULT_TIME : null)}
          trackColor={{ true: color.good, false: color.line }}
        />
      </View>
      {draft ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="更改提醒時間"
          onPress={edit}
          className="min-h-[44px] flex-row items-center justify-between"
        >
          <Text className="text-base text-ink">提醒時間</Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-base text-muted">{draft}</Text>
            <ChevronIcon direction="right" size={16} tint={color.muted} />
          </View>
        </Pressable>
      ) : null}
      {/* Saving is debounced as before, so the sheet needs no confirm button. */}
      <Sheet visible={open} title="提醒時間" onClose={() => setOpen(false)}>
        <View className="items-center pb-4">
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="spinner"
            themeVariant="light"
            minuteInterval={5}
            onChange={pick}
          />
        </View>
      </Sheet>
    </View>
  );
}
