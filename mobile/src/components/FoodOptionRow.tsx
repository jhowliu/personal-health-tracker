/**
 * 加入食物、替換食物、辨識結果候選三處共用。
 *
 * 規格書的元件規則:點整列選取、選中時淡主色背景、右側固定保留 24 px 的 ✓ 位置,
 * 所以選取與否都不會造成版面位移。
 */
import { Pressable, Text, View } from 'react-native';

const CHECK_SLOT = 24;

export type FoodOptionRowProps = {
  name: string;
  /** 替換頁用:克數緊接在食物名稱右側 */
  grams?: string;
  detail?: string;
  badges?: { label: string; tone?: 'neutral' | 'primary' | 'good' | 'warm' }[];
  trailing?: string;
  note?: string;
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
  selected = false,
  onPress,
}: FoodOptionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-start gap-3 border-b border-line px-4 py-3 last:border-b-0 ${
        selected ? 'bg-primary-soft' : 'bg-surface'
      }`}
    >
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-base font-semibold text-ink">{name}</Text>
          {grams ? <Text className="text-base font-semibold text-primary">{grams}</Text> : null}
          {badges.map((badge) => {
            const skin = BADGE_SKIN[badge.tone ?? 'neutral'];
            return (
              <View key={badge.label} className={`rounded-full px-2 py-0.5 ${skin.box}`}>
                <Text className={`text-xs ${skin.text}`}>{badge.label}</Text>
              </View>
            );
          })}
        </View>
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
