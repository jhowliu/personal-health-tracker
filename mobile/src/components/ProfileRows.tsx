/** Profile rows on the settings screen. Tapping a row opens a sheet to change just that value. */
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ChoiceOption, Sheet } from '@/components/Sheet';
import { Text } from '@/components/text';
import { Field, PrimaryButton } from '@/components/ui';

function TapRow({
  label,
  display,
  onPress,
}: {
  label: string;
  display: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`更改${label}`}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-between py-3"
    >
      <Text className="text-base text-ink">{label}</Text>
      {/* An editable value sits in a soft box, like a field; read-only rows show plain text. */}
      <View className="min-w-[118px] shrink rounded-field border border-line bg-warm-soft px-3 py-2">
        <Text className="shrink text-right text-base text-ink">{display}</Text>
      </View>
    </Pressable>
  );
}

/** A value picked from a short list: sex, activity level, deficit. */
export function ChoiceRow<T extends string | number>({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  /** Loosely typed on purpose: the profile response says string/number, the options carry the literals. */
  value: string | number;
  options: { value: T; label: string }[];
  onSave: (next: T) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  const choose = async (next: T) => {
    setOpen(false);
    if (next !== value) await onSave(next);
  };

  return (
    <View>
      <TapRow label={label} display={current?.label ?? String(value)} onPress={() => setOpen(true)} />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View className="gap-2 pb-4">
          {options.map((option) => (
            <ChoiceOption
              key={String(option.value)}
              label={option.label}
              selected={option.value === value}
              onPress={() => choose(option.value)}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** A number typed in: age, height, weight. Save stays off until the value is inside [min, max]. */
export function NumberRow({
  label,
  unit,
  value,
  min,
  max,
  decimal = false,
  onSave,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  decimal?: boolean;
  onSave: (next: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const parsed = Number(draft);
  const valid =
    draft.trim() !== '' &&
    Number.isFinite(parsed) &&
    (decimal || Number.isInteger(parsed)) &&
    parsed >= min &&
    parsed <= max;

  const show = () => {
    setDraft(String(value));
    setOpen(true);
  };
  const save = async () => {
    setOpen(false);
    if (parsed !== value) await onSave(parsed);
  };

  return (
    <View>
      <TapRow label={label} display={`${value} ${unit}`} onPress={show} />
      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View className="gap-3 pb-4">
          <View className="flex-row">
            <Field
              autoFocus
              value={draft}
              onChangeText={setDraft}
              suffix={unit}
              keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
              accessibilityLabel={label}
            />
          </View>
          <PrimaryButton onPress={save} disabled={!valid}>
            儲存
          </PrimaryButton>
        </View>
      </Sheet>
    </View>
  );
}
