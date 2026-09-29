/** The morning weigh-in reminder control on the settings screen: a switch and a time. */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { NumberStepper } from '@/components/NumberStepper';
import { Hint } from '@/components/ui';
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

  return (
    <View className="gap-3 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-0.5 pr-4">
          <Text className="text-base text-ink">早上提醒量體重</Text>
          <Hint>{draft ? '今天已經量過,就不會再提醒。' : '關閉'}</Hint>
        </View>
        <Switch
          value={draft !== null}
          onValueChange={(on) => setDraft(on ? DEFAULT_TIME : null)}
          trackColor={{ true: color.good, false: color.line }}
        />
      </View>
      {draft ? (
        <View className="flex-row items-center justify-end gap-2">
          <NumberStepper
            value={time.hour}
            min={0}
            max={23}
            format={(n) => String(n).padStart(2, '0')}
            onChange={(hour) => setDraft(formatReminderTime(hour, time.minute))}
          />
          <Text className="text-base text-ink">:</Text>
          <NumberStepper
            value={time.minute}
            min={0}
            max={55}
            step={5}
            format={(n) => String(n).padStart(2, '0')}
            onChange={(minute) => setDraft(formatReminderTime(time.hour, minute))}
          />
        </View>
      ) : null}
    </View>
  );
}
