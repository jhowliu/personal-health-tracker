/** A cartoon of an exercise: how it starts and where it ends, drawn from joint angles. */
import { useMemo } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { ChevronIcon } from '@/components/icons';
import { color } from '@/theme/tokens';
import { EXERCISE_IMAGES } from '@/workouts/figure/exercise-images';
import { moveFor } from '@/workouts/figure/moves';
import {
  extent,
  geometry,
  HEAD_R,
  PALETTE,
  shapes,
  type Extent,
  type Geometry,
  type Layer,
  type Pose,
  type Pt,
  type Shape,
} from '@/workouts/figure/skeleton';

type Built = { pose: Pose; g: Geometry; props: Shape[]; box: Extent };

function build(pose: Pose): Built {
  const g = geometry(pose);
  const props = shapes(pose, g);
  return { pose, g, props, box: extent(pose, g, props) };
}

/** One scale for both ends, so the figure does not seem to grow between them. */
function fit(a: Built, b: Built): number {
  const width = Math.max(a.box.maxX - a.box.minX, b.box.maxX - b.box.minX);
  const height = Math.max(a.box.maxY - a.box.minY, b.box.maxY - b.box.minY);
  return Math.min(86 / width, 78 / height, 1.5);
}

const stroke = (a: Pt, b: Pt, width: number, tint: string, key: string) => (
  <Line
    key={key}
    x1={a[0]}
    y1={a[1]}
    x2={b[0]}
    y2={b[1]}
    stroke={tint}
    strokeWidth={width}
    strokeLinecap="round"
  />
);

function drawShapes(list: Shape[], layer: Layer) {
  return list
    .filter((shape) => shape.layer === layer)
    .map((shape, index) => {
      const key = `${layer}-${index}`;
      switch (shape.kind) {
        case 'circle':
          return <Circle key={key} cx={shape.c[0]} cy={shape.c[1]} r={shape.r} fill={shape.fill} />;
        case 'ring':
          return (
            <Circle
              key={key}
              cx={shape.c[0]}
              cy={shape.c[1]}
              r={shape.r}
              fill="none"
              stroke={shape.stroke}
              strokeWidth={shape.w}
            />
          );
        case 'line':
          return stroke(shape.a, shape.b, shape.w, shape.stroke, key);
        case 'arc':
          return (
            <Path
              key={key}
              d={`M${shape.a[0]} ${shape.a[1]} Q${shape.c[0]} ${shape.c[1]} ${shape.b[0]} ${shape.b[1]}`}
              fill="none"
              stroke={shape.stroke}
              strokeWidth={shape.w}
              strokeLinecap="round"
            />
          );
      }
    });
}

function arm(side: Geometry['near'], far: boolean, key: string) {
  return (
    <G key={key}>
      {stroke(side.shoulder, side.elbow, 8.5, far ? PALETTE.shirtFar : PALETTE.shirt, 'upper')}
      {stroke(side.elbow, side.wrist, 7, far ? PALETTE.skinFar : PALETTE.skin, 'fore')}
      <Circle cx={side.wrist[0]} cy={side.wrist[1]} r={4} fill={far ? PALETTE.skinFar : PALETTE.skin} />
    </G>
  );
}

function leg(side: Geometry['near'], far: boolean, key: string) {
  return (
    <G key={key}>
      {stroke(side.hip, side.knee, 11, far ? PALETTE.shortsFar : PALETTE.shorts, 'thigh')}
      {stroke(side.knee, side.ankle, 8, far ? PALETTE.skinFar : PALETTE.skin, 'shin')}
      {stroke(side.ankle, side.toe, 7, PALETTE.shoe, 'shoe')}
    </G>
  );
}

function Face({ g }: { g: Geometry }) {
  const [cx, cy] = g.head;
  if (g.front) {
    return (
      <G>
        <Circle cx={cx} cy={cy - 1.8} r={HEAD_R + 0.8} fill={PALETTE.hair} />
        <Circle cx={cx} cy={cy} r={HEAD_R} fill={PALETTE.skin} />
        <Circle cx={cx - 3.3} cy={cy - 0.4} r={1.3} fill={color.ink} />
        <Circle cx={cx + 3.3} cy={cy - 0.4} r={1.3} fill={color.ink} />
        <Circle cx={cx - 5.6} cy={cy + 2.6} r={1.8} fill={PALETTE.blush} opacity={0.7} />
        <Circle cx={cx + 5.6} cy={cy + 2.6} r={1.8} fill={PALETTE.blush} opacity={0.7} />
        <Path
          d={`M${cx - 2.8} ${cy + 3.2} Q${cx} ${cy + 6} ${cx + 2.8} ${cy + 3.2}`}
          fill="none"
          stroke={color.ink}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </G>
    );
  }
  return (
    <G transform={`rotate(${g.headTurn} ${cx} ${cy})`}>
      <Circle cx={cx - 1.8} cy={cy - 1.6} r={HEAD_R + 0.6} fill={PALETTE.hair} />
      <Circle cx={cx} cy={cy} r={HEAD_R} fill={PALETTE.skin} />
      <Circle cx={cx + 3.8} cy={cy - 1.2} r={1.4} fill={color.ink} />
      <Circle cx={cx + 1.4} cy={cy + 3} r={1.9} fill={PALETTE.blush} opacity={0.7} />
      <Path
        d={`M${cx + 2.4} ${cy + 3.6} Q${cx + 4.6} ${cy + 5.6} ${cx + 6.8} ${cy + 3.2}`}
        fill="none"
        stroke={color.ink}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </G>
  );
}

function Figure({ built, scale, size }: { built: Built; scale: number; size: number }) {
  const { pose, g, props, box } = built;
  const dx = -(box.minX + box.maxX) / 2;
  const dy = -box.maxY - (pose.lift ?? 0);
  const water = pose.props?.some((prop) => prop.kind === 'water');

  const torso = g.front ? (
    <G>
      {stroke(g.hip, g.shoulder, 17, PALETTE.shirt, 'torso')}
      {stroke(g.far.hip, g.near.hip, 13, PALETTE.shorts, 'hips')}
    </G>
  ) : (
    <G>
      <Path
        d={`M${g.hip[0]} ${g.hip[1]} L${g.mid[0]} ${g.mid[1]} L${g.shoulder[0]} ${g.shoulder[1]}`}
        fill="none"
        stroke={PALETTE.shirt}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={g.hip[0]} cy={g.hip[1]} r={8.5} fill={PALETTE.shorts} />
    </G>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {water ? null : (
        <Line x1={10} y1={88} x2={90} y2={88} stroke={PALETTE.floor} strokeWidth={2.5} strokeLinecap="round" />
      )}
      <G transform={`translate(50 88) scale(${scale})`}>
        <G transform={`translate(${dx} ${dy})`}>
          {drawShapes(props, 'back')}
          {arm(g.far, true, 'arm-far')}
          {leg(g.far, true, 'leg-far')}
          {torso}
          {leg(g.near, false, 'leg-near')}
          {drawShapes(props, 'mid')}
          <Face g={g} />
          {arm(g.near, false, 'arm-near')}
          {drawShapes(props, 'top')}
        </G>
      </G>
    </Svg>
  );
}

/**
 * A picture of the exercise: an illustration from `assets/exercise/` when there is one for
 * this id, and the cartoon drawn below when there is not. `-start` and `-end` pictures show
 * both ends of the movement; a single picture is shown on its own.
 */
export function ExerciseFigure({
  exerciseId,
  name,
  mode,
}: {
  exerciseId: string;
  name: string;
  /** `pair` shows the start and the end; `single` is a small tile of the working position. */
  mode: 'pair' | 'single';
}) {
  const startPicture = EXERCISE_IMAGES[`${exerciseId}-start`];
  const endPicture = EXERCISE_IMAGES[`${exerciseId}-end`];
  const picture = endPicture ?? EXERCISE_IMAGES[exerciseId] ?? startPicture;

  const drawn = useMemo(() => {
    if (picture !== undefined) return null;
    const move = moveFor(exerciseId, name);
    const first = build(move.start);
    const last = build(move.end);
    return { start: first, end: last, scale: fit(first, last) };
  }, [exerciseId, name, picture]);

  if (picture !== undefined) {
    if (mode === 'single') {
      return (
        <View aria-hidden className="h-12 w-12 overflow-hidden rounded-field bg-surface">
          <Image source={picture} resizeMode="contain" style={{ width: 48, height: 48 }} />
        </View>
      );
    }
    if (startPicture !== undefined && endPicture !== undefined) {
      return (
        <View aria-hidden className="flex-row items-center justify-center gap-1 rounded-field bg-surface py-2">
          <Image source={startPicture} resizeMode="contain" style={{ width: 120, height: 120 }} />
          <ChevronIcon direction="right" size={18} tint={color.muted} />
          <Image source={endPicture} resizeMode="contain" style={{ width: 120, height: 120 }} />
        </View>
      );
    }
    return (
      <View aria-hidden className="items-center rounded-field bg-surface py-2">
        <Image source={picture} resizeMode="contain" style={{ width: 140, height: 140 }} />
      </View>
    );
  }

  if (!drawn) return null;
  const { start, end, scale } = drawn;

  if (mode === 'single') {
    return (
      <View aria-hidden className="h-12 w-12 overflow-hidden rounded-field bg-surface">
        <Figure built={end} scale={scale} size={48} />
      </View>
    );
  }

  return (
    <View aria-hidden className="flex-row items-center justify-center gap-1 rounded-field bg-fill py-2">
      <Figure built={start} scale={scale} size={108} />
      <ChevronIcon direction="right" size={18} tint={color.muted} />
      <Figure built={end} scale={scale} size={108} />
    </View>
  );
}
