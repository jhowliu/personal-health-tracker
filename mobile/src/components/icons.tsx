/** Line icons drawn with react-native-svg, so they look the same on every platform and follow the theme. */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/theme/tokens';

type IconProps = {
  size?: number;
  /** Stroke colour. Defaults to the link colour. */
  tint?: string;
};

/**
 * Icons are decorative: each one sits beside a visible label, or inside a button that carries
 * its own accessibilityLabel. Hiding them keeps screen readers from announcing a bare image.
 */
function Icon({ size = 20, tint = color.primary, children }: IconProps & { children: ReactNode }) {
  return (
    <View aria-hidden>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tint}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </Svg>
    </View>
  );
}

const CHEVRON_PATH = {
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
} as const;

/** Right opens another screen or sheet, left goes back, up and down expand in place. */
export function ChevronIcon({ direction, ...props }: IconProps & { direction: keyof typeof CHEVRON_PATH }) {
  return (
    <Icon {...props}>
      <Path d={CHEVRON_PATH[direction]} />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.4-2h7.2L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <Circle cx={12} cy={13} r={3.5} />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
    </Icon>
  );
}
