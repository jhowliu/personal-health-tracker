/** Line icons drawn with react-native-svg, so they look the same on every platform and follow the theme. */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/theme/tokens';

export type IconProps = {
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

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 20l4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16zM14.8 6.4l3 3" />
    </Icon>
  );
}

export function UtensilsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M16 3v18M16 3c2.2 1.8 3 4.2 3 7h-3" />
    </Icon>
  );
}

export function BowlIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 11h16c0 5-3.6 8-8 8s-8-3-8-8ZM7 21h10M8 8c0-1 1-1 1-2s-1-1-1-2M12 8c0-1 1-1 1-2s-1-1-1-2M16 8c0-1 1-1 1-2" />
    </Icon>
  );
}

export function ProteinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M14.5 4.5c3-1.2 5.8.2 6.5 2.5.9 3-1.8 7-6.2 8.7-4.4 1.8-8.9.6-9.8-2.4-.7-2.3 1.2-4.8 4.2-6.1" />
      <Circle cx={14.5} cy={9.5} r={2} />
      <Path d="M6.5 15.5 4 18m0 0-1.2-1.2M4 18l1.2 1.2" />
    </Icon>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M20 4C12 4 5 8.5 5 15c0 3 2 5 5 5 6.5 0 10-7 10-16Z" />
      <Path d="M4 21c3-5 7-8 12-11" />
    </Icon>
  );
}

export function FruitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 8c-2.2-2.1-6-1.1-7 2.3C3.8 14.6 6.7 20 10 20c.8 0 1.3-.4 2-.4s1.2.4 2 .4c3.3 0 6.2-5.4 5-9.7C18 6.9 14.2 5.9 12 8Z" />
      <Path d="M12 8c0-2 1-4 3-5M13 5c1.6 0 3 .5 4 1.5" />
    </Icon>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11Z" />
    </Icon>
  );
}

export function RunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx={15} cy={4.5} r={1.8} />
      <Path d="M14 7.5 11 13M14 7.5l3.5 2.5 2.5-1M13.2 9l-3.7.5-2 2.5M11 13l3.5 2.5-1 5M11 13l-2 4-4 1" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
      <Circle cx={12} cy={12} r={3} />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 9h10v11H9zM5 15V4h11" />
    </Icon>
  );
}
