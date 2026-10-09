/**
 * A list whose rows can be dragged into a new order by the handle on each row.
 *
 * Rows sit absolutely, each at the summed height of the rows above it in the current order. A
 * row that opens or closes pushes the rest along smoothly, and a move only changes the order.
 * Heights are measured as rows lay out. Dragging lifts the row under the finger and the others
 * slide to make room; letting go settles it and reports the new order once.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { GripIcon } from '@/components/icons';
import { color } from '@/theme/tokens';

const SPRING = { damping: 22, stiffness: 260, mass: 0.6 };

type Layout = {
  order: SharedValue<string[]>;
  heights: SharedValue<Record<string, number>>;
  dragging: SharedValue<string | null>;
  dragTop: SharedValue<number>;
  estimate: number;
  divided: boolean;
};

/** How far down `key` sits when the rows run in `order`. */
function topOf(key: string, order: string[], heights: Record<string, number>, estimate: number) {
  'worklet';
  let top = 0;
  for (const other of order) {
    if (other === key) return top;
    top += heights[other] ?? estimate;
  }
  return top;
}

function totalOf(order: string[], heights: Record<string, number>, estimate: number) {
  'worklet';
  let total = 0;
  for (const key of order) total += heights[key] ?? estimate;
  return total;
}

export function ReorderList<T>({
  items,
  keyOf,
  renderRow,
  onReorder,
  onDragChange,
  disabled,
  divided = true,
  estimatedHeight = 66,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Draws one row; `handle` is the drag handle to place in it, or null while disabled. */
  renderRow: (item: T, handle: ReactNode) => ReactNode;
  /** The keys in their new order, after a drag that moved something. */
  onReorder: (keys: string[]) => void;
  /** Told when a drag starts and ends, to pause the page's scrolling or close open rows. */
  onDragChange?: (dragging: boolean) => void;
  disabled?: boolean;
  /** Rows of one card, split by hairlines. Off for separate cards that keep their own look. */
  divided?: boolean;
  /** Used for a row until it has been measured. */
  estimatedHeight?: number;
}) {
  const keys = items.map(keyOf);
  const signature = keys.join('|');
  const order = useSharedValue<string[]>(keys);
  const heights = useSharedValue<Record<string, number>>({});
  const dragging = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0);
  const layout: Layout = { order, heights, dragging, dragTop, estimate: estimatedHeight, divided };

  // The caller's order wins whenever it changes: after a save, or an item added or removed.
  useEffect(() => {
    order.set(signature ? signature.split('|') : []);
  }, [signature, order]);

  const containerStyle = useAnimatedStyle(() => ({
    height: totalOf(order.get(), heights.get(), estimatedHeight),
  }));

  return (
    <Animated.View style={containerStyle}>
      {items.map((item) => {
        const key = keyOf(item);
        return (
          <ReorderRow
            key={key}
            id={key}
            layout={layout}
            disabled={disabled || items.length < 2}
            onReorder={onReorder}
            onDragChange={onDragChange}
            render={(handle) => renderRow(item, handle)}
          />
        );
      })}
    </Animated.View>
  );
}

function ReorderRow({
  id,
  layout,
  disabled,
  onReorder,
  onDragChange,
  render,
}: {
  id: string;
  layout: Layout;
  disabled?: boolean;
  onReorder: (keys: string[]) => void;
  onDragChange?: (dragging: boolean) => void;
  render: (handle: ReactNode) => ReactNode;
}) {
  const { order, heights, dragging, dragTop, estimate, divided } = layout;
  const startOrder = useSharedValue<string[]>([]);
  const startTop = useSharedValue(0);

  const lift = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onDragChange?.(true);
  };
  const settle = (moved: boolean, keys: string[]) => {
    onDragChange?.(false);
    if (moved) onReorder(keys);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onStart(() => {
      startOrder.set(order.get());
      startTop.set(topOf(id, order.get(), heights.get(), estimate));
      dragTop.set(startTop.get());
      dragging.set(id);
      runOnJS(lift)();
    })
    .onUpdate((event) => {
      const own = heights.get()[id] ?? estimate;
      const max = totalOf(order.get(), heights.get(), estimate) - own;
      const raw = startTop.get() + event.translationY;
      dragTop.set(Math.min(Math.max(raw, 0), Math.max(max, 0)));

      // Slot the row into the gap among the others whose top is nearest the finger's position,
      // so either way a row trades places once it is dragged half a row. The finger's own
      // position decides, not the drawn one held inside the list, so dragging past an end
      // always reaches it.
      const rest = order.get().filter((key) => key !== id);
      let at = 0;
      let nearest = Infinity;
      let edge = 0;
      for (let gap = 0; gap <= rest.length; gap += 1) {
        const distance = Math.abs(edge - raw);
        if (distance < nearest) {
          nearest = distance;
          at = gap;
        }
        if (gap < rest.length) edge += heights.get()[rest[gap]] ?? estimate;
      }
      const next = [...rest.slice(0, at), id, ...rest.slice(at)];
      if (next.join('|') !== order.get().join('|')) order.set(next);
    })
    .onFinalize(() => {
      if (dragging.get() !== id) return;
      dragging.set(null);
      const moved = order.get().join('|') !== startOrder.get().join('|');
      runOnJS(settle)(moved, order.get());
    });

  const style = useAnimatedStyle(() => {
    const active = dragging.get() === id;
    const top = active ? dragTop.get() : topOf(id, order.get(), heights.get(), estimate);
    return {
      top: active ? top : withSpring(top, SPRING),
      zIndex: active ? 10 : 0,
      backgroundColor: divided ? (active ? color.warmSoft : color.surface) : 'transparent',
      shadowOpacity: active ? 0.18 : 0,
      elevation: active ? 6 : 0,
      // The divider sits on top of every row but the first in the current order.
      borderTopWidth: divided && order.get()[0] !== id ? 1 : 0,
    };
  });

  const handle = disabled ? null : (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="按住拖曳調整順序"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="h-11 w-9 items-center justify-center"
      >
        <GripIcon size={18} tint={color.muted} />
      </View>
    </GestureDetector>
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          borderTopColor: color.line,
          shadowColor: color.edge,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
        },
        style,
      ]}
      onLayout={(event) => {
        const height = Math.round(event.nativeEvent.layout.height);
        if (heights.get()[id] !== height) heights.set({ ...heights.get(), [id]: height });
      }}
    >
      {render(handle)}
    </Animated.View>
  );
}
