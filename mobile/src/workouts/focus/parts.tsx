/** The building blocks of the focus screen (spec §3 B–E, §7). */
import { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { color } from '@/theme/tokens';

/** Timers and weights must not jitter as digits change. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

export function clock(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** 45 → "45", 47.5 → "47.5". */
export const kg = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** For screen readers: 84 → "1 分 24 秒". */
export function spokenDuration(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m ? `${m} 分 ${s} 秒` : `${s} 秒`;
}

/** − value + ; holding a button keeps stepping, the way a gym machine's pin is moved. */
export function Stepper({
  label,
  value,
  unit,
  onStep,
}: {
  label: string;
  value: string;
  unit: string;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-base text-muted">{label}</Text>
      <View className="flex-row items-center gap-1">
        <HoldButton label={`減少${label}`} symbol="−" onStep={() => onStep(-1)} />
        <View className="min-w-[110px] flex-row items-baseline justify-center">
          <Text className="text-[38px] text-ink" style={tabular}>
            {value}
          </Text>
          <Text className="ml-1 text-sm text-muted">{unit}</Text>
        </View>
        <HoldButton label={`增加${label}`} symbol="+" onStep={() => onStep(1)} />
      </View>
    </View>
  );
}

function HoldButton({ label, symbol, onStep }: { label: string; symbol: string; onStep: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const repeat = () => {
    onStep();
    timer.current = setTimeout(repeat, 110);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onStep}
      onLongPress={() => {
        timer.current = setTimeout(repeat, 0);
      }}
      onPressOut={stop}
      delayLongPress={400}
      className="h-14 w-[60px] items-center justify-center rounded-button border-2 border-edge bg-surface active:bg-warm-soft"
    >
      <Text className="text-[28px] text-ink">{symbol}</Text>
    </Pressable>
  );
}

const RING = 200;
const STROKE = 12;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The rest countdown: the ring shrinks as the rest runs out (spec §3 D). */
export function RestRing({ leftSec, totalSec }: { leftSec: number; totalSec: number }) {
  const fraction = totalSec > 0 ? Math.min(1, leftSec / totalSec) : 0;
  return (
    <View
      accessible
      accessibilityLabel={`休息剩餘 ${spokenDuration(leftSec)}`}
      className="items-center justify-center self-center"
      style={{ width: RING, height: RING }}
    >
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke="#EBCFDD" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={color.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Text className="text-sm text-primary">休息中</Text>
      <Text className="text-[52px] font-extrabold text-ink" style={tabular}>
        {clock(leftSec)}
      </Text>
    </View>
  );
}

/** One dot per planned set: done (filled green), current (primary ring), still to come. */
export function SetDots({ done, total }: { done: number; total: number }) {
  return (
    <View className="flex-row gap-2" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          className={`h-[18px] w-[18px] rounded-full border-2 ${
            index < done ? 'border-good bg-good' : index === done ? 'border-primary bg-surface' : 'border-line'
          }`}
        />
      ))}
    </View>
  );
}

/** One segment per exercise: done, current, or not started. */
export function Segments({ states, resting }: { states: ('done' | 'current' | 'todo')[]; resting: boolean }) {
  return (
    <View className="flex-row gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {states.map((state, index) => (
        <View
          key={index}
          className={`h-1.5 flex-1 rounded-full ${
            state === 'done' ? 'bg-good' : state === 'current' ? 'bg-primary' : resting ? 'bg-[#EBCFDD]' : 'bg-line'
          }`}
        />
      ))}
    </View>
  );
}
