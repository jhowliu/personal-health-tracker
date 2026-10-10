/** Shared building blocks. Styling lives here so screens never re-declare cards and buttons. */
import {
  Children,
  Fragment,
  type ComponentType,
  type ReactNode,
  useContext,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type KeyboardTypeOptions,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { FrameHostContext } from '@/components/frame-host';
import { ChevronIcon, PlusIcon, type IconProps } from '@/components/icons';
import { Text, TextInput } from '@/components/text';
import { color } from '@/theme/tokens';

/**
 * nativeID of the accessory bar rendered once in the root layout.
 *
 * iOS numeric keypads have no return key, so without this there is no key that
 * dismisses them. Tapping blank space works too, but a visible 完成 is what people
 * reach for.
 */
export const NUMERIC_ACCESSORY_ID = 'numeric-done-bar';

const NUMERIC_KEYBOARDS: KeyboardTypeOptions[] = ['numeric', 'decimal-pad', 'number-pad'];

export function Screen({
  children,
  scroll = true,
  pinnedHeader,
  footer,
  footerSafeArea = true,
  scrollEnabled = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Off while something on the screen is being dragged, so the page does not scroll with it. */
  scrollEnabled?: boolean;
  /** Fixed above the scroll area for controls that must remain available while browsing. */
  pinnedHeader?: ReactNode;
  /** Pinned below the scroll area — for a running total the user needs while editing. */
  footer?: ReactNode;
  /** Disable when the screen is already above a tab bar that owns the bottom safe area. */
  footerSafeArea?: boolean;
}) {
  return (
    <SafeAreaView
      className="flex-1 bg-bg"
      edges={footerSafeArea && !footer ? ['top', 'bottom'] : ['top']}
    >
      <KeyboardAvoidingView
        className="flex-1"
        // Android already resizes the window; adding padding on top double-counts it.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {pinnedHeader ? <View className="gap-3 bg-bg px-5 pb-3 pt-2">{pinnedHeader}</View> : null}
        {scroll ? (
          <ScrollView
            className="flex-1"
            scrollEnabled={scrollEnabled}
            contentContainerClassName="px-5 pb-8 pt-2 gap-4"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        ) : (
          // Not a ScrollView, so a tap on empty space is the only way out.
          <Pressable
            accessible={false}
            onPress={Keyboard.dismiss}
            className="flex-1 px-5 pb-8 pt-2"
          >
            {children}
          </Pressable>
        )}

        {/* Inside KeyboardAvoidingView so it rides up with the keyboard. Padding sits on the inner
            View: on web SafeAreaView writes its own inline padding over any className padding. */}
        {footer ? (
          <SafeAreaView edges={footerSafeArea ? ['bottom'] : []} className="border-t border-line bg-bg">
            <View className="gap-2 px-5 pb-3 pt-3">{footer}</View>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Draws a hairline *between* children — never after the last one.
 *
 * Do not reach for `last:border-b-0` instead: NativeWind has no child-position variants
 * on native, so that silently wipes every border on a device while looking right on web.
 */
export function Rows({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <View className="h-px bg-line" /> : null}
          {child}
        </Fragment>
      ))}
    </>
  );
}

export function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <View className="gap-1">
      <Text accessibilityRole="header" className="text-[28px] leading-[38px] text-ink">
        {children}
      </Text>
      {sub ? <Text className="text-sm text-muted">{sub}</Text> : null}
    </View>
  );
}

export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-[17px] text-ink">
        {children}
      </Text>
      {action}
    </View>
  );
}

export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View
      // overflow-hidden clips children to the radius. Without it a child that paints its
      // own background (FoodOptionRow) covers the corners and the card renders square.
      className={`overflow-hidden rounded-card border-2 border-edge bg-surface p-4 ${className}`}
      {...props}
    />
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text className="text-base text-ink">{label}</Text>
      {typeof value === 'string' ? <Text className="text-base text-muted">{value}</Text> : value}
    </View>
  );
}

export function Field({
  label,
  suffix,
  className = '',
  ...props
}: TextInputProps & { label?: string; suffix?: string; className?: string }) {
  const labelId = useId();
  const needsDoneBar =
    Platform.OS === 'ios' && NUMERIC_KEYBOARDS.includes(props.keyboardType as KeyboardTypeOptions);

  return (
    <View className="flex-1 gap-1">
      {label ? (
        <Text nativeID={labelId} className="text-sm text-muted">
          {label}
        </Text>
      ) : null}
      <View className="flex-row items-center rounded-field border-[1.5px] border-edge bg-surface px-3">
        <TextInput
          // min-w-0: a browser input keeps its default width otherwise and pushes the suffix out.
          className={`min-h-[44px] min-w-0 flex-1 text-base text-ink ${className}`}
          placeholderTextColor={color.placeholder}
          inputAccessoryViewID={needsDoneBar ? NUMERIC_ACCESSORY_ID : undefined}
          accessibilityLabel={props.accessibilityLabel ?? label}
          accessibilityLabelledBy={props.accessibilityLabelledBy ?? (label ? labelId : undefined)}
          {...props}
        />
        {suffix ? <Text className="pl-2 text-sm text-muted">{suffix}</Text> : null}
      </View>
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
  busy,
  tone = 'primary',
  icon: Icon,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** `danger` is an outlined button for deleting something for good. */
  tone?: 'primary' | 'dark' | 'plain' | 'danger';
  /** An icon component from `icons.tsx`, drawn before the label in the label's colour. */
  icon?: ComponentType<{ tint?: string }>;
}) {
  const unavailable = disabled || busy;
  // The berry button is the main action; outlined ones sit beside or under it.
  const skin = {
    primary: 'min-h-[47px] rounded-button border-2 border-edge bg-primary',
    dark: 'min-h-[47px] rounded-button border-2 border-edge bg-ink',
    plain: 'min-h-[44px] rounded-control border-[1.5px] border-edge bg-surface',
    danger: 'min-h-[44px] rounded-control border-[1.5px] border-edge bg-surface',
  }[tone];
  const label = { primary: 'text-white', dark: 'text-white', plain: 'text-ink', danger: 'text-danger' }[tone];
  const iconTint = { primary: color.surface, dark: color.surface, plain: color.ink, danger: color.danger }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(busy), disabled: Boolean(unavailable) }}
      onPress={onPress}
      disabled={unavailable}
      className={`items-center justify-center ${skin} ${
        Icon ? 'flex-row gap-2' : ''
      } ${unavailable ? 'opacity-40' : 'active:opacity-80'}`}
    >
      {Icon ? <Icon tint={iconTint} /> : null}
      <Text className={`text-base ${label} ${Icon ? 'shrink' : ''}`}>{children}</Text>
    </Pressable>
  );
}

/**
 * A standalone text action ("編輯", "換動作"): no underline, colour says what it does.
 * hitSlop lifts the touch area to 44pt without moving the layout. Two of them side by side
 * need a gap of at least 16 so their touch areas do not overlap. `className` is layout only,
 * for example `min-h-[44px] justify-center`.
 */
export function TextAction({
  label,
  onPress,
  disabled,
  tone = 'primary',
  icon: Icon,
  accessibilityLabel,
  className = '',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `danger` removes something, `muted` is a quiet way out such as 收起. */
  tone?: 'primary' | 'danger' | 'muted';
  icon?: ComponentType<{ size?: number; tint?: string }>;
  accessibilityLabel?: string;
  className?: string;
}) {
  const text = { primary: 'text-primary', danger: 'text-danger', muted: 'text-muted' }[tone];
  const tint = { primary: color.primary, danger: color.danger, muted: color.muted }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      className={`flex-row items-center gap-1 ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {Icon ? <Icon size={16} tint={tint} /> : null}
      <Text className={`text-base ${text}`}>{label}</Text>
    </Pressable>
  );
}

/** The berry "＋ 新增" button beside a tab's title. */
export function HeaderAddButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-button border-2 border-edge bg-primary px-4 active:opacity-80"
    >
      <PlusIcon size={17} tint={color.surface} />
      <Text className="text-base text-white">{label}</Text>
    </Pressable>
  );
}

/**
 * A square outlined icon button beside a tab's title, such as the camera on 餐點. `badge` puts
 * a berry dot on its corner for something new behind it; say so in the label too.
 */
export function HeaderIconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  badge,
}: {
  icon: ComponentType<IconProps>;
  accessibilityLabel: string;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-control border-2 border-edge bg-surface active:opacity-70"
    >
      <Icon size={20} tint={color.ink} />
      {badge ? (
        <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-bg bg-primary" />
      ) : null}
    </Pressable>
  );
}

/** The outlined "＋ 加入…" button that ends a list the person can add to: a workout, a meal. */
export function AddRow({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-control border-[1.5px] border-edge bg-surface ${
        disabled ? 'opacity-40' : 'active:opacity-70'
      }`}
    >
      <PlusIcon size={15} tint={color.ink} />
      <Text className="text-sm text-ink">{label}</Text>
    </Pressable>
  );
}

/**
 * The "‹ Destination" link at the top of a pushed screen. Name the screen it returns to
 * ("今天", "訓練"), not the verb. hitSlop lifts the touch area to 44pt without moving the layout.
 */
export function BackLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`返回${label}`}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 24 }}
      className="flex-row items-center gap-0.5 self-start"
    >
      <ChevronIcon direction="left" size={18} />
      <Text className="text-base text-primary">{label}</Text>
    </Pressable>
  );
}

/**
 * How "selected" looks, so a new control picks one of these instead of inventing another:
 * - one choice among a few options (Segmented, Chip): an outlined pill on a soft fill;
 * - a row picked from a list (ChoiceOption, FoodOptionRow): primary-soft fill and a check;
 * - where you are (tab bar, StepIndicator): the primary colour on primary-soft.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Kept for callers; both tones now draw the same outlined track. */
  tone?: 'dark' | 'soft';
}) {
  return (
    <View className="flex-row rounded-[14px] border-2 border-edge bg-fill p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={`min-h-[42px] flex-1 items-center justify-center rounded-control border-[1.5px] ${
              active ? 'border-edge bg-primary-soft' : 'border-transparent'
            }`}
          >
            <Text className={`text-base ${active ? 'text-primary' : 'text-muted'}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type Tone = 'neutral' | 'primary' | 'good' | 'warm' | 'purple';

const TONE_SKIN: Record<Tone, string> = {
  neutral: 'bg-fill',
  primary: 'bg-primary-soft',
  good: 'bg-good-soft',
  warm: 'bg-warm-soft',
  purple: 'bg-purple-soft',
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-muted',
  primary: 'text-primary',
  good: 'text-good',
  warm: 'text-warm',
  purple: 'text-purple',
};

/** A filter or option pill. Selected, it is outlined on the soft yellow of the journal. */
export function Chip({
  label,
  selected,
  onPress,
  tone,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** A coloured label rather than a choice; left out, the chip is plain text until selected. */
  tone?: Tone;
}) {
  const skin = selected
    ? 'border-edge bg-warm-soft'
    : tone
      ? `border-transparent ${TONE_SKIN[tone]}`
      : 'border-transparent';
  const text = selected || !tone ? 'text-ink' : TONE_TEXT[tone];

  const content = (
    <View className={`rounded-control border-[1.5px] px-3 py-1.5 ${skin}`}>
      <Text className={`text-sm ${text}`}>{label}</Text>
    </View>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      className="min-h-[44px] justify-center"
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

/** A small label pill inside a list card, such as 肌力 or 在家. */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className={`rounded-full px-2 py-0.5 ${TONE_SKIN[tone]}`}>
      <Text className={`text-xs ${TONE_TEXT[tone]}`}>{label}</Text>
    </View>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <Text className="text-sm text-muted">{children}</Text>;
}

const TIP_MARGIN = 16;
const TIP_MAX_WIDTH = 260;
const TIP_GAP = 8;
const TIP_ARROW = 12;

/**
 * A row label with an (i) button beside it. Tapping the button floats the explanation next to it;
 * tapping anywhere else closes it.
 */
export function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  const button = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const window = useWindowDimensions();
  // In the web phone frame the modal covers the frame, not the browser window, so measure against it.
  const frame = useContext(FrameHostContext);
  const screen = frame ? { width: frame.clientWidth, height: frame.clientHeight } : window;

  const show = () =>
    button.current?.measureInWindow((x, y, width, height) => {
      const origin = frame?.getBoundingClientRect();
      setAnchor({ x: x - (origin?.left ?? 0), y: y - (origin?.top ?? 0), width, height });
    });
  const hide = () => setAnchor(null);

  // Centre the bubble on the button, then keep it inside the screen. Below the button unless the
  // button sits low on the screen, where it opens upward.
  const bubbleWidth = Math.min(TIP_MAX_WIDTH, screen.width - TIP_MARGIN * 2);
  let bubble = null;
  if (anchor) {
    const centre = anchor.x + anchor.width / 2;
    const left = Math.min(
      Math.max(centre - bubbleWidth / 2, TIP_MARGIN),
      screen.width - TIP_MARGIN - bubbleWidth,
    );
    const above = anchor.y > screen.height * 0.6;
    const arrowLeft = Math.min(
      Math.max(centre - left - TIP_ARROW / 2, TIP_ARROW),
      bubbleWidth - TIP_ARROW * 2,
    );
    bubble = (
      <View
        accessibilityRole="alert"
        className="absolute rounded-field bg-ink px-3 py-2"
        style={{
          left,
          width: bubbleWidth,
          ...(above
            ? { bottom: screen.height - anchor.y + TIP_GAP }
            : { top: anchor.y + anchor.height + TIP_GAP }),
        }}
      >
        <View
          className="absolute bg-ink"
          style={{
            left: arrowLeft,
            width: TIP_ARROW,
            height: TIP_ARROW,
            ...(above ? { bottom: -TIP_ARROW / 2 } : { top: -TIP_ARROW / 2 }),
            transform: [{ rotate: '45deg' }],
          }}
        />
        <Text className="text-sm text-white">{tip}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row items-center gap-2 pr-4">
      <Text className="shrink text-base text-ink">{label}</Text>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={`${label}說明`}
        hitSlop={12}
        onPress={show}
        className="h-[18px] w-[18px] items-center justify-center rounded-full border border-muted"
      >
        <Text className="text-xs text-muted">i</Text>
      </Pressable>
      {/* Translucent status bar keeps the modal's coordinates the same as measureInWindow's on Android. */}
      <AppModal visible={anchor !== null} transparent statusBarTranslucent animationType="fade" onRequestClose={hide}>
        <Pressable accessible={false} onPress={hide} className="flex-1">
          {bubble}
        </Pressable>
      </AppModal>
    </View>
  );
}

/** "Nothing here yet": muted text, plus an optional action when there is a way forward. */
export function Empty({
  children,
  action,
  compact,
}: {
  children: React.ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View className={`items-center gap-3 ${compact ? 'py-6' : 'py-12'}`}>
      <Text className="text-center text-base text-muted">{children}</Text>
      {action}
    </View>
  );
}
