/** A list card that opens in place: a summary that toggles, the details, and two actions. */
import type { ComponentType, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronIcon, type IconProps } from '@/components/icons';
import { color } from '@/theme/tokens';

export type CardAction = {
  label: string;
  /** What a screen reader says, with the subject in it: "編輯雞胸胡麻花椰飯". */
  accessibilityLabel: string;
  icon: ComponentType<IconProps>;
  onPress: () => void;
  /** `danger` is for deleting something for good. */
  tone?: 'default' | 'danger';
};

export function ExpandableCard({
  name,
  expanded,
  busy,
  onToggle,
  summary,
  details,
  actions,
}: {
  /** Read as "展開{name}" or "收起{name}". */
  name: string;
  expanded: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** Always visible: the title line, tags and a one-line preview. */
  summary: ReactNode;
  /** Shown when open, inside a soft rounded box. */
  details: ReactNode;
  actions: CardAction[];
}) {
  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled: Boolean(busy) }}
        accessibilityLabel={`${expanded ? '收起' : '展開'}${name}`}
        disabled={busy}
        onPress={onToggle}
        className={`min-h-[104px] flex-row items-start gap-3 px-4 py-3 active:bg-fill ${
          busy ? 'opacity-40' : ''
        }`}
      >
        <View className="flex-1 gap-1.5">{summary}</View>
        <View className="h-11 justify-center self-center">
          <ChevronIcon direction={expanded ? 'up' : 'down'} size={16} tint={color.muted} />
        </View>
      </Pressable>

      {expanded ? (
        <View className="gap-3 px-4 pb-4">
          <View className="rounded-field bg-fill px-3">{details}</View>

          <View className="flex-row gap-3">
            {actions.map((action) => {
              const danger = action.tone === 'danger';
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel}
                  disabled={busy}
                  onPress={action.onPress}
                  className={`min-h-[44px] flex-1 flex-row items-center justify-center gap-2 rounded-field active:opacity-70 ${
                    danger ? 'bg-primary-soft' : 'bg-fill'
                  }`}
                >
                  <action.icon size={17} tint={danger ? color.danger : color.ink} />
                  <Text className={`text-base font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}
