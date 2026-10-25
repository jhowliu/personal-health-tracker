/**
 * The paper-journal details: dotted paper behind every page, a highlighter under headings,
 * stickers on blank pages, a stamp on a finished day and tape on the weekly report.
 *
 * All of it is decoration. It is hidden from screen readers, takes no touches, and uses the
 * `deco` colours only in small areas; text stays in the regular ink colours.
 */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

import { PawIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { color, deco } from '@/theme/tokens';

const DOT_GAP = 20;

/** Dot-grid paper. Put it first inside a full-screen container; it fills it and stays behind. */
export function Paper() {
  return (
    <View aria-hidden className="absolute inset-0" style={{ pointerEvents: 'none' }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="journal-dots" width={DOT_GAP} height={DOT_GAP} patternUnits="userSpaceOnUse">
            <Circle cx={DOT_GAP / 2} cy={DOT_GAP / 2} r={1.1} fill={color.line} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#journal-dots)" />
      </Svg>
    </View>
  );
}

const MARKER = {
  // A 28 px page title.
  title: { height: 13, bottom: 5 },
  // A 24 px step or report heading.
  heading: { height: 11, bottom: 4 },
} as const;

/**
 * A highlighter stroke under the lower half of a heading. On a heading that wraps it marks the
 * last line. `className` is layout only: `shrink` in a row, `self-start` in a column.
 */
export function Highlight({
  children,
  size = 'heading',
  className = '',
}: {
  children: ReactNode;
  size?: keyof typeof MARKER;
  className?: string;
}) {
  const marker = MARKER[size];
  return (
    <View className={className}>
      <View
        aria-hidden
        className="absolute -left-1 -right-1 rounded-[3px] bg-deco-yellow"
        style={{
          height: marker.height,
          bottom: marker.bottom,
          opacity: 0.75,
          pointerEvents: 'none',
          transform: [{ rotate: '-0.8deg' }],
        }}
      />
      {children}
    </View>
  );
}

export type StickerKind = 'bowl' | 'dumbbell' | 'scale' | 'notebook';

/** Each drawing, in colour or as a plain white shape for the die-cut edge drawn under it. */
const STICKER_ART: Record<StickerKind, (paint: (fill: string) => string) => ReactNode> = {
  bowl: (paint) => (
    <>
      <Path d="M26 14c-2-3 2-5 0-8M37 14c-2-3 2-5 0-8" fill="none" />
      <Path d="M15 31c2-8 9-12 17-12s15 4 17 12" fill={paint(deco.yellow)} />
      <Path d="M9 31h46c0 12-10 21-23 21S9 43 9 31Z" fill={paint(deco.coral)} />
      <Rect x={24} y={51} width={16} height={5} rx={2.5} fill={paint(deco.coral)} />
    </>
  ),
  dumbbell: (paint) => (
    <>
      <Rect x={18} y={30} width={28} height={4} rx={2} fill={paint(color.edge)} />
      <Rect x={10} y={20} width={9} height={24} rx={3} fill={paint(deco.blue)} />
      <Rect x={45} y={20} width={9} height={24} rx={3} fill={paint(deco.blue)} />
      <Rect x={5} y={25} width={6} height={14} rx={2} fill={paint(deco.blue)} />
      <Rect x={53} y={25} width={6} height={14} rx={2} fill={paint(deco.blue)} />
    </>
  ),
  scale: (paint) => (
    <>
      <Rect x={10} y={12} width={44} height={42} rx={11} fill={paint(deco.blue)} />
      <Path d="M20 31a12 12 0 0 1 24 0Z" fill={paint(color.surface)} />
      <Path d="M32 31l5-7M21 45h7M36 45h7" fill="none" />
    </>
  ),
  notebook: (paint) => (
    <>
      <Rect x={15} y={9} width={36} height={46} rx={4} fill={paint(deco.yellow)} />
      <Path d="M39 9v13l4-3 4 3V9" fill={paint(deco.coral)} />
      <Path d="M23 28h20M23 36h20M23 44h13" fill="none" />
      <Circle cx={15} cy={19} r={3} fill={paint(color.surface)} />
      <Circle cx={15} cy={32} r={3} fill={paint(color.surface)} />
      <Circle cx={15} cy={45} r={3} fill={paint(color.surface)} />
    </>
  ),
};

const STICKER_TILT: Record<StickerKind, string> = { bowl: '-6deg', dumbbell: '-14deg', scale: '4deg', notebook: '5deg' };

/** A small sticker for a blank page, drawn in ink like the cards, with a white die-cut edge. */
export function Sticker({ kind, size = 60 }: { kind: StickerKind; size?: number }) {
  const art = STICKER_ART[kind];
  return (
    <View aria-hidden style={{ transform: [{ rotate: STICKER_TILT[kind] }] }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G stroke={color.surface} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
          {art(() => color.surface)}
        </G>
        <G stroke={color.edge} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {art((fill) => fill)}
        </G>
      </Svg>
    </View>
  );
}

/**
 * The rubber stamp on a finished day, the same paw print the calendar stamps on it. It presses
 * down once when it appears; with reduced motion it is simply there.
 */
export function DayStamp({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const press = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    press.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.exp) });
  }, [press]);

  const pressed = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * press.value,
    transform: [{ rotate: '-10deg' }, { scale: 1.35 - 0.35 * press.value }],
  }));

  return (
    <Animated.View aria-hidden style={pressed}>
      <View className="h-[74px] w-[74px] items-center justify-center rounded-full border-[2.5px] border-primary">
        <View className="absolute inset-[4px] rounded-full border border-dashed border-primary" />
        <PawIcon size={22} tint={color.primary} />
        <Text className="text-xs text-primary">{label}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * An exercise's place in a workout, ticked off in pen once it is done, so the day's exercises
 * read like a checklist in the book. `current` marks the one being done now.
 */
export function CheckNumber({ number, done = false, current = false }: { number: number; done?: boolean; current?: boolean }) {
  return (
    <View
      className={`h-6 w-6 items-center justify-center rounded-full border-[1.5px] ${
        done ? 'border-good bg-good-soft' : current ? 'border-primary bg-surface' : 'border-edge bg-surface'
      }`}
    >
      {done ? (
        // The long stroke runs out past the circle, the way a quick tick does.
        <View aria-hidden className="absolute -top-1.5 left-0.5" style={{ pointerEvents: 'none' }}>
          <Svg width={26} height={24} viewBox="0 0 26 24">
            <Path
              d="M4 13.5c2.2 1.6 4 3.6 5.4 6.2C12.6 12.4 17 6.4 23 2.5"
              fill="none"
              stroke={color.good}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ) : (
        <Text className={`text-xs ${current ? 'text-primary' : 'text-ink'}`}>{number}</Text>
      )}
    </View>
  );
}

const PRINT_TILTS = ['-2deg', '1.5deg', '-1deg', '2deg'];

/** Each exercise's picture keeps one slight angle wherever it appears, like a print stuck in. */
export function printTilt(key: string): string {
  let sum = 0;
  for (let index = 0; index < key.length; index += 1) sum += key.charCodeAt(index);
  return PRINT_TILTS[sum % PRINT_TILTS.length];
}

const TAPE_EDGE = 'M3 0h86l3 4-3 4 3 4-3 4 3 4-3 4H3l-3-4 3-4-3-4 3-4-3-4 3-4Z';

/**
 * A strip of washi tape across the top edge of a card or picture, as if it were taped into the
 * book. Its parent needs room above it: the tape stands 12 px proud of the top edge.
 */
export function Tape() {
  return (
    <View aria-hidden className="absolute -top-3 left-0 right-0 items-center" style={{ pointerEvents: 'none' }}>
      <View style={{ transform: [{ rotate: '-4deg' }] }}>
        <Svg width={92} height={24} viewBox="0 0 92 24">
          <Defs>
            <Pattern id="journal-tape" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect width={4} height={8} fill={color.surface} opacity={0.35} />
            </Pattern>
          </Defs>
          <Path d={TAPE_EDGE} fill={deco.blue} opacity={0.85} />
          <Path d={TAPE_EDGE} fill="url(#journal-tape)" />
        </Svg>
      </View>
    </View>
  );
}
