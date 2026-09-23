/**
 * Shared by three screens: add food, substitute food, and photo-recognition candidates.
 *
 * The spec's component rules: the whole row is the tap target, selection paints a soft
 * primary background, and 24 px is always reserved on the right for the checkmark — so
 * selecting never shifts the layout.
 */
import { Pressable, Text, View } from 'react-native';

const CHECK_SLOT = 24;

export type FoodOptionRowProps = {
  name: string;
  /** Substitute screen: grams sit immediately right of the food name */
  grams?: string;
  detail?: string;
  badges?: { label: string; tone?: 'neutral' | 'primary' | 'good' | 'warm' }[];
  trailing?: string;
  note?: string;
  /**
   * Substitute screen puts the badges on their own line under the name, because they
   * describe the conversion. The food picker keeps them inline, where they are just a
   * category tag. Explicit rather than inferred from `grams` — that rule would bite later.
   */
  badgesBelow?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

const BADGE_SKIN = {
  neutral: { box: 'bg-fill', text: 'text-muted' },
  primary: { box: 'bg-primary-soft', text: 'text-primary' },
  good: { box: 'bg-good-soft', text: 'text-good' },
  warm: { box: 'bg-warm-soft', text: 'text-warm' },
} as const;

export function FoodOptionRow({
  name,
  grams,
  detail,
  badges = [],
  trailing,
  note,
  badgesBelow = false,
  selected = false,
  onPress,
}: FoodOptionRowProps) {
  const chips = badges.map((badge) => {
    const skin = BADGE_SKIN[badge.tone ?? 'neutral'];
    return (
      <View key={badge.label} className={`rounded-full px-2 py-0.5 ${skin.box}`}>
        <Text className={`text-xs ${skin.text}`}>{badge.label}</Text>
      </View>
    );
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-start gap-3 px-4 py-3 ${
        selected ? 'bg-primary-soft' : 'bg-surface'
      }`}
    >
      <View className="flex-1 gap-1.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-base font-semibold text-ink">{name}</Text>
          {grams ? <Text className="text-base font-semibold text-primary">{grams}</Text> : null}
          {badgesBelow ? null : chips}
        </View>
        {badgesBelow && chips.length ? (
          <View className="flex-row flex-wrap gap-2">{chips}</View>
        ) : null}
        {detail ? <Text className="text-sm text-muted">{detail}</Text> : null}
        {note ? <Text className="text-sm text-warm">{note}</Text> : null}
      </View>

      {trailing ? <Text className="pt-0.5 text-sm text-muted">{trailing}</Text> : null}

      <View style={{ width: CHECK_SLOT }} className="items-end pt-0.5">
        {selected ? <Text className="text-base text-primary">✓</Text> : null}
      </View>
    </Pressable>
  );
}
