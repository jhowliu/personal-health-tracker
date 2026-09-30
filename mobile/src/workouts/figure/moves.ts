/** What each exercise looks like at its two ends, and which exercise gets which figure. */
import type { Limb, Move, Pose, Prop } from '@/workouts/figure/skeleton';

type Hold = 'barbell' | 'dumbbell' | 'none';

const plate = (hold: Hold): Prop[] =>
  hold === 'barbell'
    ? [{ kind: 'plate', at: 'hand', r: 7 }]
    : hold === 'dumbbell'
      ? [{ kind: 'plate', at: 'hand', r: 4.5 }]
      : [];

const STAND: Pose = { torso: 0, arm: [4, 6], leg: [0, 0] };

function squat(hold: Hold): Move {
  const rack: Limb = [30, 200];
  const chest: Limb = [20, 150];
  const startArm: Limb = hold === 'barbell' ? rack : hold === 'dumbbell' ? chest : [4, 6];
  const endArm: Limb = hold === 'barbell' ? rack : hold === 'dumbbell' ? chest : [90, 90];
  const props: Prop[] = hold === 'barbell' ? [{ kind: 'plate', at: 'shoulder', r: 7 }] : plate(hold);
  return {
    start: { torso: 0, arm: startArm, leg: [0, 0], props },
    end: { torso: 38, head: -28, arm: endArm, leg: [85, -20], props },
  };
}

function lunge(hold: Hold): Move {
  const arm: Limb = hold === 'none' ? [12, 14] : [3, 3];
  const props = plate(hold);
  return {
    start: { torso: 0, arm, leg: [0, 0], props },
    end: { torso: 5, arm, leg: [80, -5], legFar: [-45, -70], footFar: 50, props },
  };
}

function hinge(): Move {
  const props = plate('barbell');
  return {
    start: { torso: 0, arm: [8, 8], leg: [0, 0], props },
    end: { torso: 75, head: -40, arm: [0, 0], leg: [10, -2], props },
  };
}

function bridge(bar: boolean): Move {
  const props: Prop[] = bar
    ? [{ kind: 'bench' }, { kind: 'plate', at: 'hip', r: 7 }]
    : [];
  return {
    start: { torso: -90, arm: [90, 90], leg: [135, 5], props: bar ? [{ kind: 'bench' }] : [] },
    end: { torso: -142, head: 52, arm: [90, 90], leg: [60, 0], props },
  };
}

function bench(hold: Hold): Move {
  const props: Prop[] = [{ kind: 'bench' }, ...plate(hold)];
  const legs = { leg: [70, 5] as Limb };
  return {
    start: { torso: -90, arm: [180, 180], ...legs, props },
    // Not flat on the chest: raised a little so the weight still shows above it.
    end: { torso: -90, arm: [55, 180], ...legs, props },
  };
}

function overheadPress(hold: Hold): Move {
  const props = plate(hold);
  return {
    start: { torso: 0, arm: [40, 190], leg: [0, 0], props },
    end: { torso: 0, arm: [178, 178], leg: [0, 0], props },
  };
}

function row(hold: Hold): Move {
  const props = plate(hold);
  const base = { torso: 70, head: -35, leg: [15, -10] as Limb, props };
  return {
    start: { ...base, arm: [0, 0] },
    end: { ...base, arm: [-50, 40] },
  };
}

/** Seated on a machine with the legs out front: the cable row and the rowing machine. */
function seatedRow(): Move {
  const base = { leg: [80, 80] as Limb, props: [{ kind: 'seat' }] as Prop[] };
  return {
    start: { ...base, torso: 25, head: -10, arm: [80, 80] },
    end: { ...base, torso: -5, head: 0, arm: [-30, 60] },
  };
}

function pullUp(): Move {
  return {
    start: { view: 'front', torso: 0, arm: [168, 172], leg: [3, 3], props: [{ kind: 'bar' }] },
    end: { view: 'front', torso: 0, arm: [100, 176], leg: [3, 3], props: [{ kind: 'bar' }] },
  };
}

function pulldown(): Move {
  const props: Prop[] = [{ kind: 'bar' }, { kind: 'seat' }];
  return {
    start: { view: 'front', torso: 0, arm: [168, 172], leg: [22, 2], props },
    end: { view: 'front', torso: 0, arm: [100, 176], leg: [22, 2], props },
  };
}

function pushUp(): Move {
  return {
    start: { torso: 68, head: -20, arm: [0, 0], leg: [-68, -68], foot: 60 },
    end: { torso: 82, head: -20, arm: [-62, 4], leg: [-82, -82], foot: 60 },
  };
}

function lateralRaise(): Move {
  const props = plate('dumbbell');
  return {
    start: { view: 'front', torso: 0, arm: [8, 8], leg: [4, 4], props },
    end: { view: 'front', torso: 0, arm: [95, 95], leg: [4, 4], props },
  };
}

function legExtension(reverse: boolean): Move {
  const bent: Pose = { torso: 0, arm: [10, 10], leg: [90, 0], props: [{ kind: 'seat' }] };
  const straight: Pose = { ...bent, leg: [90, 88] };
  return reverse ? { start: straight, end: bent } : { start: bent, end: straight };
}

function legPress(): Move {
  const base = { torso: -55, arm: [70, 70] as Limb, props: [{ kind: 'seat' }] as Prop[] };
  return {
    start: { ...base, leg: [120, 60] },
    end: { ...base, leg: [115, 115] },
  };
}

function calfRaise(): Move {
  return {
    start: { ...STAND, foot: 90 },
    end: { ...STAND, foot: 50 },
  };
}

function quadruped(): Move {
  const base = { torso: 80, arm: [0, 0] as Limb, leg: [0, -88] as Limb };
  return {
    start: { ...base, spine: 30, head: 30 },
    end: { ...base, spine: -30, head: -30 },
  };
}

function thoracicRotation(): Move {
  const base = { torso: 80, leg: [0, -88] as Limb };
  return {
    start: { ...base, arm: [0, 0], head: 0 },
    end: { ...base, arm: [172, 176], armFar: [0, 0], head: 30 },
  };
}

function hipFlexorStretch(): Move {
  const legs = { leg: [80, -5] as Limb, legFar: [-45, -70] as Limb, footFar: 50 };
  return {
    start: { torso: 20, arm: [20, 20], ...legs },
    end: { torso: -5, arm: [170, 170], ...legs },
  };
}

function bandPullApart(): Move {
  const props: Prop[] = [{ kind: 'band' }];
  return {
    start: { view: 'front', torso: 0, arm: [40, -70], leg: [4, 4], props },
    end: { view: 'front', torso: 0, arm: [90, 90], leg: [4, 4], props },
  };
}

function shoulderCircles(): Move {
  return {
    start: { view: 'front', torso: 0, arm: [70, 70], leg: [4, 4] },
    end: { view: 'front', torso: 0, arm: [115, 115], leg: [4, 4] },
  };
}

function run(props: Prop[] = []): Move {
  const a: Pose = {
    torso: 12,
    head: -10,
    arm: [-45, 45],
    armFar: [45, 170],
    leg: [70, -10],
    legFar: [-25, -60],
    props,
  };
  const b: Pose = {
    torso: 12,
    head: -10,
    arm: [45, 170],
    armFar: [-45, 45],
    leg: [-25, -60],
    legFar: [70, -10],
    props,
  };
  return { start: a, end: b };
}

function cycle(): Move {
  const props: Prop[] = [{ kind: 'bike' }];
  const base = { torso: 40, head: -25, arm: [40, 60] as Limb, props };
  return {
    start: { ...base, leg: [70, 10], legFar: [30, -5] },
    end: { ...base, leg: [30, -5], legFar: [70, 10] },
  };
}

function swim(): Move {
  const props: Prop[] = [{ kind: 'water' }];
  return {
    start: { torso: 90, head: -10, arm: [95, 95], armFar: [-90, -90], leg: [-85, -85], legFar: [-80, -95], props },
    end: { torso: 90, head: -10, arm: [-90, -90], armFar: [95, 95], leg: [-80, -95], legFar: [-85, -85], props },
  };
}

function jumpRope(): Move {
  return {
    start: { view: 'front', torso: 0, arm: [40, 30], leg: [3, 3], props: [{ kind: 'rope', over: true }] },
    end: { view: 'front', torso: 0, arm: [40, 30], leg: [10, -10], lift: 8, props: [{ kind: 'rope', over: false }] },
  };
}

const armsUp = (): Move => ({
  start: { view: 'front', torso: 0, arm: [8, 8], leg: [4, 4] },
  end: { view: 'front', torso: 0, arm: [150, 150], leg: [10, 10] },
});

const BY_ID: Record<string, () => Move> = {
  'barbell-back-squat': () => squat('barbell'),
  'barbell-romanian-deadlift': hinge,
  'barbell-hip-thrust': () => bridge(true),
  'dumbbell-goblet-squat': () => squat('dumbbell'),
  'dumbbell-reverse-lunge': () => lunge('dumbbell'),
  'dumbbell-bulgarian-split-squat': () => lunge('dumbbell'),
  'leg-press-machine': legPress,
  'leg-extension-machine': () => legExtension(false),
  'seated-leg-curl-machine': () => legExtension(true),
  'standing-calf-raise-machine': calfRaise,
  'bodyweight-squat': () => squat('none'),
  'bodyweight-walking-lunge': () => lunge('none'),
  'glute-bridge': () => bridge(false),
  'barbell-bench-press': () => bench('barbell'),
  'barbell-overhead-press': () => overheadPress('barbell'),
  'barbell-bent-over-row': () => row('barbell'),
  'dumbbell-incline-press': () => bench('dumbbell'),
  'dumbbell-shoulder-press': () => overheadPress('dumbbell'),
  'dumbbell-one-arm-row': () => row('dumbbell'),
  'dumbbell-lateral-raise': lateralRaise,
  'lat-pulldown-machine': pulldown,
  'seated-cable-row': seatedRow,
  'chest-press-machine': () => bench('none'),
  'push-up': pushUp,
  'pull-up': pullUp,
  dip: pushUp,
  'inverted-row': () => row('none'),
  'cat-cow': quadruped,
  'worlds-greatest-stretch': hipFlexorStretch,
  'hip-flexor-stretch': hipFlexorStretch,
  'thoracic-rotation': thoracicRotation,
  'band-pull-apart': bandPullApart,
  'shoulder-circles': shoulderCircles,
  'incline-treadmill-walk': () => run(),
  'cycling-stationary': cycle,
  'rowing-erg': seatedRow,
  elliptical: () => run(),
  'stair-climber': () => run(),
  'jump-rope': jumpRope,
  'running-outdoor': () => run(),
  'cycling-outdoor': cycle,
  'swimming-freestyle': swim,
  'tennis-singles': () => run([{ kind: 'racket' }]),
  badminton: () => run([{ kind: 'racket' }]),
  basketball: () => run([{ kind: 'ball' }]),
};

// Custom exercises have no fixed id, so their names decide. Longer, more specific words first.
const BY_NAME: [RegExp, () => Move][] = [
  [/高腳杯|深蹲/, () => squat('none')],
  [/硬舉|早安式/, hinge],
  [/弓箭步|分腿蹲|登階/, () => lunge('none')],
  [/臀推|臀橋/, () => bridge(false)],
  [/臥推|胸推|夾胸/, () => bench('none')],
  [/肩推|上推/, () => overheadPress('none')],
  [/划船|俯身/, () => row('none')],
  [/下拉|引體/, pullUp],
  [/伏地挺身|撐體|俯臥撐/, pushUp],
  [/側平舉|前平舉/, lateralRaise],
  [/腿屈伸|腿彎舉/, () => legExtension(false)],
  [/提踵/, calfRaise],
  [/貓牛|伸展|拉伸/, hipFlexorStretch],
  [/游泳|自由式/, swim],
  [/跳繩/, jumpRope],
  [/騎|單車|飛輪/, cycle],
  [/跑|走|橢圓|爬/, () => run()],
];

const cache = new Map<string, Move>();

/** The figure for an exercise; anything unrecognised gets a friendly arms-up stretch. */
export function moveFor(exerciseId: string, name: string): Move {
  const key = `${exerciseId}|${name}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const build =
    BY_ID[exerciseId] ?? BY_NAME.find(([pattern]) => pattern.test(name))?.[1] ?? armsUp;
  const move = build();
  cache.set(key, move);
  return move;
}

