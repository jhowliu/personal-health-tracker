/**
 * A cartoon figure is a skeleton: a few joint angles in, points and shapes out. Angles are in
 * degrees. Limbs are measured from straight down toward the direction the figure faces (90 is
 * horizontal, 180 is straight up); the torso is measured from straight up toward the facing
 * direction (0 is upright, 90 leans flat forward, -90 lies on the back).
 */
import { color } from '@/theme/tokens';

export type Pt = readonly [number, number];
export type Limb = readonly [upper: number, lower: number];

export type Prop =
  | { kind: 'plate'; at: 'hand' | 'shoulder' | 'hip'; r?: number }
  | { kind: 'bench' }
  | { kind: 'seat' }
  | { kind: 'bar' }
  | { kind: 'band' }
  | { kind: 'rope'; over: boolean }
  | { kind: 'water' }
  | { kind: 'bike' }
  | { kind: 'racket' }
  | { kind: 'ball' };

export type Pose = {
  /** Side view faces right. Front view is symmetric and ignores the torso lean. */
  view?: 'side' | 'front';
  torso: number;
  /** Bends the back: positive sags in the middle, negative arches. */
  spine?: number;
  /** Head tilt on top of the torso's own angle. */
  head?: number;
  arm: Limb;
  armFar?: Limb;
  leg: Limb;
  legFar?: Limb;
  /** Foot direction, same scale as a limb. 90 is flat on the floor. */
  foot?: number;
  footFar?: number;
  /** How far the body is off the floor, for jumps. */
  lift?: number;
  props?: Prop[];
};

export type Move = { start: Pose; end: Pose };

export const LEN = { torso: 24, neck: 12, upperArm: 12, foreArm: 11, thigh: 16, shin: 15, foot: 6 };
export const HEAD_R = 9;

export const PALETTE = {
  skin: '#F3C9A5',
  skinFar: '#E0AC86',
  shirt: color.primary,
  shirtFar: '#86204F',
  shorts: '#3F3B3D',
  shortsFar: '#2A2728',
  shoe: color.ink,
  hair: '#3A2A24',
  blush: '#F2A0A0',
  prop: color.muted,
  floor: color.line,
  water: '#A9CFE8',
  accent: '#E7A33C',
};

type Side = { shoulder: Pt; hip: Pt; elbow: Pt; wrist: Pt; knee: Pt; ankle: Pt; toe: Pt };

export type Geometry = {
  front: boolean;
  hip: Pt;
  mid: Pt;
  shoulder: Pt;
  head: Pt;
  /** Degrees to turn the face so it follows the body's axis. */
  headTurn: number;
  near: Side;
  far: Side;
};

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** A point `length` away, `angle` from straight down toward `side` (1 forward/right, -1 back/left). */
function down(from: Pt, angle: number, length: number, side = 1): Pt {
  return [from[0] + side * Math.sin(rad(angle)) * length, from[1] + Math.cos(rad(angle)) * length];
}

function up(from: Pt, angle: number, length: number): Pt {
  return [from[0] + Math.sin(rad(angle)) * length, from[1] - Math.cos(rad(angle)) * length];
}

export function geometry(pose: Pose): Geometry {
  const front = pose.view === 'front';
  const spine = pose.spine ?? 0;
  const hip: Pt = [0, 0];
  const mid = up(hip, pose.torso - spine / 2, LEN.torso / 2);
  const shoulder = up(mid, pose.torso + spine / 2, LEN.torso / 2);
  const tilt = pose.torso + spine / 2 + (pose.head ?? 0);
  const head = front ? ([0, -LEN.torso - LEN.neck] as Pt) : up(shoulder, tilt, LEN.neck);

  const build = (sideSign: 1 | -1, arm: Limb, leg: Limb, foot: number): Side => {
    const shoulderAt: Pt = front ? [sideSign * 7, -LEN.torso] : shoulder;
    const hipAt: Pt = front ? [sideSign * 4, 0] : hip;
    const elbow = down(shoulderAt, arm[0], LEN.upperArm, front ? sideSign : 1);
    const wrist = down(elbow, arm[1], LEN.foreArm, front ? sideSign : 1);
    const knee = down(hipAt, leg[0], LEN.thigh, front ? sideSign : 1);
    const ankle = down(knee, leg[1], LEN.shin, front ? sideSign : 1);
    const toe: Pt = front
      ? [ankle[0] + sideSign * LEN.foot * 0.7, ankle[1] + 1]
      : down(ankle, foot, LEN.foot);
    return { shoulder: shoulderAt, hip: hipAt, elbow, wrist, knee, ankle, toe };
  };

  return {
    front,
    hip,
    mid,
    shoulder: front ? [0, -LEN.torso] : shoulder,
    head,
    headTurn: front ? 0 : tilt,
    near: build(1, pose.arm, pose.leg, pose.foot ?? 90),
    far: build(-1, pose.armFar ?? pose.arm, pose.legFar ?? pose.leg, pose.footFar ?? pose.foot ?? 90),
  };
}

export type Layer = 'back' | 'mid' | 'top';

export type Shape =
  | { kind: 'circle'; c: Pt; r: number; fill: string; layer: Layer }
  | { kind: 'ring'; c: Pt; r: number; w: number; stroke: string; layer: Layer }
  | { kind: 'line'; a: Pt; b: Pt; w: number; stroke: string; layer: Layer }
  | { kind: 'arc'; a: Pt; c: Pt; b: Pt; w: number; stroke: string; layer: Layer };

const add = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];

/** The equipment around a pose, placed from where the body ended up. */
export function shapes(pose: Pose, g: Geometry): Shape[] {
  const out: Shape[] = [];
  const forearm = (side: Side): Pt => {
    const dx = side.wrist[0] - side.elbow[0];
    const dy = side.wrist[1] - side.elbow[1];
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  };

  for (const prop of pose.props ?? []) {
    switch (prop.kind) {
      case 'plate': {
        const r = prop.r ?? 7;
        const centres: Pt[] =
          prop.at === 'hand'
            ? g.front
              ? [g.near.wrist, g.far.wrist]
              : [g.near.wrist]
            : prop.at === 'shoulder'
              ? [add(g.shoulder, -3, -1)]
              : [add(g.hip, 0, -3)];
        for (const c of centres) {
          out.push({ kind: 'circle', c, r, fill: PALETTE.prop, layer: 'mid' });
          out.push({ kind: 'circle', c, r: r * 0.4, fill: PALETTE.skin, layer: 'mid' });
        }
        break;
      }
      case 'bench': {
        const y = Math.max(g.shoulder[1], g.hip[1]) + 10;
        const left = Math.min(g.shoulder[0], g.hip[0]) - 8;
        const right = Math.max(g.shoulder[0], g.hip[0]) + 10;
        out.push({ kind: 'line', a: [left, y], b: [right, y], w: 6, stroke: PALETTE.prop, layer: 'back' });
        out.push({ kind: 'line', a: [left + 4, y], b: [left + 4, y + 14], w: 4, stroke: PALETTE.prop, layer: 'back' });
        out.push({ kind: 'line', a: [right - 4, y], b: [right - 4, y + 14], w: 4, stroke: PALETTE.prop, layer: 'back' });
        break;
      }
      case 'seat': {
        const y = g.hip[1] + 10;
        out.push({ kind: 'line', a: [g.hip[0] - 8, y], b: [g.hip[0] + 9, y], w: 5, stroke: PALETTE.prop, layer: 'back' });
        out.push({ kind: 'line', a: [g.hip[0], y], b: [g.hip[0], y + 14], w: 4, stroke: PALETTE.prop, layer: 'back' });
        break;
      }
      case 'bar': {
        const y = g.near.wrist[1];
        out.push({
          kind: 'line',
          a: [g.far.wrist[0] - 10, y],
          b: [g.near.wrist[0] + 10, y],
          w: 3,
          stroke: PALETTE.prop,
          layer: 'mid',
        });
        break;
      }
      case 'band':
        out.push({ kind: 'line', a: g.far.wrist, b: g.near.wrist, w: 2, stroke: PALETTE.accent, layer: 'top' });
        break;
      case 'rope': {
        const footY = Math.max(g.near.toe[1], g.far.toe[1]);
        const control: Pt = [0, prop.over ? g.head[1] - 30 : footY + 20];
        out.push({ kind: 'arc', a: g.far.wrist, c: control, b: g.near.wrist, w: 1.8, stroke: PALETTE.accent, layer: 'top' });
        break;
      }
      case 'water': {
        const y = g.shoulder[1] + 8;
        out.push({ kind: 'line', a: [g.shoulder[0] - 34, y], b: [g.shoulder[0] + 34, y], w: 2.5, stroke: PALETTE.water, layer: 'back' });
        break;
      }
      case 'bike': {
        const [hx, hy] = g.hip;
        out.push({ kind: 'ring', c: [hx - 24, hy + 20], r: 14, w: 2.2, stroke: PALETTE.prop, layer: 'back' });
        out.push({ kind: 'ring', c: [hx + 26, hy + 20], r: 14, w: 2.2, stroke: PALETTE.prop, layer: 'back' });
        const frame: [Pt, Pt][] = [
          [[hx - 24, hy + 20], [hx + 2, hy + 21]],
          [[hx + 2, hy + 21], [hx - 1, hy + 8]],
          [[hx - 1, hy + 8], [hx + 18, hy + 2]],
          [[hx + 18, hy + 2], [hx + 26, hy + 20]],
          [[hx + 2, hy + 21], [hx + 18, hy + 2]],
        ];
        for (const [a, b] of frame) {
          out.push({ kind: 'line', a, b, w: 2.2, stroke: PALETTE.prop, layer: 'back' });
        }
        out.push({ kind: 'line', a: [hx - 8, hy + 8], b: [hx + 2, hy + 8], w: 4, stroke: PALETTE.prop, layer: 'back' });
        break;
      }
      case 'racket': {
        const [dx, dy] = forearm(g.near);
        out.push({ kind: 'line', a: g.near.wrist, b: add(g.near.wrist, dx * 12, dy * 12), w: 2, stroke: PALETTE.prop, layer: 'top' });
        out.push({ kind: 'ring', c: add(g.near.wrist, dx * 18, dy * 18), r: 6, w: 1.8, stroke: PALETTE.prop, layer: 'top' });
        break;
      }
      case 'ball': {
        const [dx, dy] = forearm(g.near);
        out.push({ kind: 'circle', c: add(g.near.wrist, dx * 7, dy * 7), r: 6, fill: PALETTE.accent, layer: 'top' });
        break;
      }
    }
  }
  return out;
}

export type Extent = { minX: number; maxX: number; minY: number; maxY: number };

/** The box a pose fills, with a little room for the thickness of limbs and shoes. */
export function extent(pose: Pose, g: Geometry, props: Shape[]): Extent {
  const pad = 4;
  const points: Pt[] = [g.hip, g.shoulder];
  for (const side of [g.near, g.far]) {
    points.push(side.elbow, side.wrist, side.knee, side.ankle, side.toe);
  }
  const box: Extent = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const take = (x: number, y: number, room: number) => {
    box.minX = Math.min(box.minX, x - room);
    box.maxX = Math.max(box.maxX, x + room);
    box.minY = Math.min(box.minY, y - room);
    box.maxY = Math.max(box.maxY, y + room);
  };
  for (const [x, y] of points) take(x, y, pad);
  take(g.head[0], g.head[1], HEAD_R + 1);
  for (const shape of props) {
    if (shape.kind === 'circle' || shape.kind === 'ring') take(shape.c[0], shape.c[1], shape.r + 1);
    else if (shape.kind === 'line') {
      take(shape.a[0], shape.a[1], shape.w / 2);
      take(shape.b[0], shape.b[1], shape.w / 2);
    } else {
      take(shape.a[0], shape.a[1], 1);
      take(shape.b[0], shape.b[1], 1);
      take(shape.c[0], (shape.c[1] + shape.a[1]) / 2, 1);
    }
  }
  return { ...box, minY: box.minY - (pose.lift ?? 0), maxY: box.maxY };
}
