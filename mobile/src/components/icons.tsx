/** Line icons from Lucide, one stroke weight everywhere, named for what they mean here. */
import {
  Apple,
  CalendarCheck,
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Droplet,
  Drumstick,
  Dumbbell,
  Eye,
  Footprints,
  GripVertical,
  Leaf,
  LogOut,
  Pencil,
  Plus,
  SlidersHorizontal,
  Soup,
  Trash2,
  Utensils,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

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
function icon(Glyph: LucideIcon) {
  return function Icon({ size = 19, tint = color.primary }: IconProps) {
    return (
      <View aria-hidden>
        <Glyph size={size} color={tint} strokeWidth={2.2} />
      </View>
    );
  };
}

const CHEVRON = {
  left: icon(ChevronLeft),
  right: icon(ChevronRight),
  up: icon(ChevronUp),
  down: icon(ChevronDown),
} as const;

/** Right opens another screen or sheet, left goes back, up and down expand in place. */
export function ChevronIcon({ direction, ...props }: IconProps & { direction: keyof typeof CHEVRON }) {
  const Chevron = CHEVRON[direction];
  return <Chevron {...props} />;
}

export const PlusIcon = icon(Plus);
export const CheckIcon = icon(Check);
export const CloseIcon = icon(X);
export const CameraIcon = icon(Camera);
export const TrashIcon = icon(Trash2);
export const PencilIcon = icon(Pencil);
export const UtensilsIcon = icon(Utensils);
export const BowlIcon = icon(Soup);
export const GrainIcon = icon(Wheat);
export const ProteinIcon = icon(Drumstick);
export const LeafIcon = icon(Leaf);
export const FruitIcon = icon(Apple);
export const DropletIcon = icon(Droplet);
export const RunIcon = icon(Footprints);
export const EyeIcon = icon(Eye);
export const CalendarCheckIcon = icon(CalendarCheck);
export const ScaleIcon = icon(ChartNoAxesCombined);
export const DumbbellIcon = icon(Dumbbell);
export const SlidersIcon = icon(SlidersHorizontal);
export const CopyIcon = icon(Copy);
export const LogOutIcon = icon(LogOut);
export const GripIcon = icon(GripVertical);
