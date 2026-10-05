import type { Schema } from '@/api/client';
import {
  REST_SEC,
  WARMUP_REST_SEC,
  adjustRest,
  awaitingFeedback,
  completeCurrent,
  currentWarmup,
  elapsedMs,
  finishedWarmups,
  fromWorkout as startSession,
  jumpTo,
  pause,
  restLeftSec,
  restore,
  resume,
  setFeedback,
  settleRest,
  skipRest,
  skipWarmup,
  step,
  summary,
  upNext,
  warmupPlan,
  type Session,
} from '@/workouts/focus/session';

type Workout = Schema<'WorkoutExecutionOut'>;

const T0 = Date.UTC(2026, 9, 2, 10, 0, 0);
const sec = (n: number) => n * 1000;

type ItemSpec = {
  id: string;
  sets?: number;
  reps?: string | null;
  durationSec?: number | null;
  weightKg?: number | null;
  equipment?: string | null;
  logs?: {
    weight_kg: number | null;
    reps_done: number | null;
    duration_sec?: number | null;
    speed_kmh?: number | null;
    incline_pct?: number | null;
  }[];
  lastSet?: {
    weight_kg: number | null;
    reps_done: number | null;
    speed_kmh?: number | null;
    incline_pct?: number | null;
  } | null;
  best?: number | null;
  suggested?: number | null;
};

/** Just the fields focus mode reads; the rest of the API shape does not matter here. */
function workout(items: ItemSpec[]): Workout {
  return {
    date: '2026-10-02',
    template: null,
    estimated_burn_kcal: null,
    items: items.map((spec) => ({
      item: {
        id: spec.id,
        exercise_id: `ex-${spec.id}`,
        exercise_name: spec.id,
        sets: spec.sets ?? 3,
        reps: spec.reps === undefined ? '10–12' : spec.reps,
        duration_sec: spec.durationSec ?? null,
        weight_kg: spec.weightKg === undefined ? 40 : spec.weightKg,
        equipment: spec.equipment ?? 'barbell',
      },
      completed_set_count: spec.logs?.length ?? 0,
      logs: (spec.logs ?? []).map((log, index) => ({ set_index: index, duration_sec: null, ...log })),
      last_set: spec.lastSet ?? null,
      best_weight_kg: spec.best ?? null,
      suggested_weight_kg: spec.suggested ?? null,
    })),
  } as unknown as Workout;
}

/**
 * Most tests here are about working sets, so their sessions start with the warm-ups already
 * skipped; the warm-up tests at the end use startSession itself.
 */
const fromWorkout = (planned: Workout, now: number): Session => {
  const session = startSession(planned, now);
  return { ...session, exercises: session.exercises.map((exercise) => ({ ...exercise, warmupSkipped: true })) };
};

/** Complete the current set `times` times, skipping each rest, and return the session. */
function doSets(session: Session, times: number, now = T0): Session {
  let current = session;
  for (let i = 0; i < times; i += 1) current = skipRest(completeCurrent(current, now).session);
  return current;
}

describe('starting values', () => {
  it('start from the suggested weight and the last reps, or the prescription the first time', () => {
    const session = fromWorkout(
      workout([
        { id: 'pulldown', lastSet: { weight_kg: 45, reps_done: 12 }, suggested: 47.5 },
        { id: 'row', weightKg: 50, reps: '10–12' },
      ]),
      T0,
    );

    expect(session.exercises[0]).toMatchObject({ weightKg: 47.5, reps: 12 });
    expect(session.exercises[1]).toMatchObject({ weightKg: 50, reps: 10 });
  });

  it('carry on from a set already logged today', () => {
    const session = fromWorkout(
      workout([{ id: 'pulldown', suggested: 47.5, logs: [{ weight_kg: 50, reps_done: 8 }] }]),
      T0,
    );

    expect(session.exercises[0]).toMatchObject({ weightKg: 50, reps: 8 });
  });

  it('treat bodyweight work as having no weight, and timed work in minutes', () => {
    const session = fromWorkout(
      workout([
        { id: 'push-up', weightKg: null, equipment: 'bodyweight' },
        { id: 'treadmill', durationSec: 20 * 60, reps: null, weightKg: null, equipment: 'treadmill' },
      ]),
      T0,
    );

    expect(session.exercises[0].weightKg).toBeNull();
    expect(session.exercises[1]).toMatchObject({ kind: 'time', minutes: 20, plannedSets: 1 });
  });

  it('start a lift from 0 when the plan sets no weight, rather than hiding the weight', () => {
    const session = fromWorkout(workout([{ id: 'squat', weightKg: null, equipment: 'barbell' }]), T0);

    expect(session.exercises[0].weightKg).toBe(0);
  });
});

describe('what comes next', () => {
  it('is the next unfinished exercise, and nothing once the one on screen is the last', () => {
    const start = fromWorkout(workout([{ id: 'a', sets: 1 }, { id: 'b', sets: 2 }]), T0);
    expect(upNext(start)).toBe(1);

    // Only b is left: its own last set has nothing after it, rather than b again.
    const onB = doSets(start, 2);
    expect(onB.currentIndex).toBe(1);
    expect(upNext(onB)).toBe(-1);
  });
});

describe('a treadmill', () => {
  const treadmill = (spec: Partial<ItemSpec> = {}) =>
    workout([{ id: 'walk', durationSec: 10 * 60, reps: null, weightKg: null, equipment: 'treadmill', ...spec }]);

  it('starts from the last speed and incline, or leaves them unset the first time', () => {
    const before = fromWorkout(
      treadmill({ lastSet: { weight_kg: null, reps_done: null, speed_kmh: 4, incline_pct: 10 } }),
      T0,
    );
    expect(before.exercises[0]).toMatchObject({ treadmill: true, speedKmh: 4, inclinePct: 10 });

    // Unset means the exercise's own MET costs it; a default nobody chose would not.
    expect(fromWorkout(treadmill(), T0).exercises[0]).toMatchObject({ speedKmh: null, inclinePct: null });
  });

  it('steps from 5 km/h and level ground once touched', () => {
    const start = fromWorkout(treadmill(), T0);
    expect(step(start, 'speed', 1).exercises[0].speedKmh).toBe(5.5);
    expect(step(start, 'incline', 1).exercises[0].inclinePct).toBe(1);
    expect(step(step(start, 'incline', 1), 'incline', -1).exercises[0].inclinePct).toBe(0);
  });

  it('logs the speed and incline with the minutes', () => {
    const tuned = step(step(fromWorkout(treadmill({ lastSet: { weight_kg: null, reps_done: null, speed_kmh: 4, incline_pct: 10 } }), T0), 'speed', 1), 'incline', -1);
    const { log } = completeCurrent(tuned, T0);
    expect(log).toMatchObject({ durationSec: 600, speedKmh: 4.5, inclinePct: 9 });
  });

  it('is the only thing that gets the two steppers', () => {
    const session = fromWorkout(workout([{ id: 'run', durationSec: 600, reps: null, weightKg: null, equipment: null }]), T0);
    expect(session.exercises[0].treadmill).toBe(false);
    expect(step(session, 'speed', 1).exercises[0].speedKmh).toBeNull();
  });
});

describe('completing a set', () => {
  it('logs it and rests before the next set of the same exercise', () => {
    const { session, log, finished } = completeCurrent(fromWorkout(workout([{ id: 'a' }, { id: 'b' }]), T0), T0);

    expect(log).toMatchObject({ itemId: 'a', setIndex: 0, weightKg: 40, reps: 10, durationSec: null });
    expect(finished).toBe(false);
    expect(session.currentIndex).toBe(0);
    expect(session.rest).toMatchObject({ totalSec: REST_SEC, nextIsNewExercise: false, finishedItemId: null });
  });

  it('moves to the next exercise after the last set, resting and asking how it felt', () => {
    const start = fromWorkout(workout([{ id: 'a', sets: 2 }, { id: 'b' }]), T0);
    const { session } = completeCurrent(doSets(start, 1), T0);

    expect(session.currentIndex).toBe(1);
    expect(session.rest).toMatchObject({ nextIsNewExercise: true, finishedItemId: 'a' });
  });

  it('does not rest into cardio, or after it', () => {
    const start = fromWorkout(
      workout([{ id: 'a', sets: 1 }, { id: 'run', durationSec: 600, reps: null }, { id: 'b' }]),
      T0,
    );
    const intoCardio = completeCurrent(start, T0).session;
    expect(intoCardio.currentIndex).toBe(1);
    expect(intoCardio.rest).toBeNull();

    const { session, log } = completeCurrent(step(intoCardio, 'minutes', 1), T0);
    expect(log).toMatchObject({ itemId: 'run', setIndex: 0, durationSec: 11 * 60, weightKg: null });
    expect(session.currentIndex).toBe(2);
    expect(session.rest).toBeNull();
  });

  // Acceptance 10: the last set goes straight to the summary, with the right totals.
  it('finishes after the last set of the day without resting', () => {
    const start = fromWorkout(workout([{ id: 'a', sets: 2 }]), T0);
    const { session, finished } = completeCurrent(doSets(start, 1), T0);

    expect(finished).toBe(true);
    expect(session.rest).toBeNull();
    expect(summary(session)).toMatchObject({ sets: 2, volumeKg: 2 * 40 * 10 });
  });
});

describe('resting', () => {
  const resting = () => completeCurrent(fromWorkout(workout([{ id: 'a' }]), T0), T0).session;

  // Acceptance 3: the time left comes from the end time, however long the app was away.
  it('counts down from the end time, not from ticks', () => {
    const session = resting();

    expect(restLeftSec(session, T0 + sec(37.2))).toBe(53);
    expect(settleRest(session, T0 + sec(89)).rest).not.toBeNull();
    expect(settleRest(session, T0 + sec(90)).rest).toBeNull();
  });

  it('adds or takes off 30 seconds, and ends when there is nothing left', () => {
    const session = resting();

    expect(restLeftSec(adjustRest(session, 30, T0), T0)).toBe(120);
    expect(restLeftSec(adjustRest(session, -30, T0), T0)).toBe(60);
    expect(adjustRest(session, -30, T0 + sec(70)).rest).toBeNull();
    expect(skipRest(session).rest).toBeNull();
  });

  // Acceptance 6: values set during the rest are the ones the next set uses.
  it('lets the next set be tuned during the rest', () => {
    const tuned = step(step(resting(), 'weight', 1), 'reps', -1);
    const { log } = completeCurrent(skipRest(tuned), T0);

    expect(log).toMatchObject({ setIndex: 1, weightKg: 42.5, reps: 9 });
  });
});

// Acceptance 7: switching exercises keeps what was done and comes back to it.
it('jumps to another exercise without losing sets, and wraps back to unfinished ones', () => {
  const start = fromWorkout(workout([{ id: 'a' }, { id: 'b', sets: 1 }, { id: 'c', sets: 1 }]), T0);
  const afterOne = completeCurrent(start, T0).session;

  const jumped = jumpTo(afterOne, 2);
  expect(jumped.currentIndex).toBe(2);
  expect(jumped.rest).toBeNull();
  expect(jumped.exercises[0].logs).toHaveLength(1);

  const { session } = completeCurrent(jumped, T0);
  expect(session.currentIndex).toBe(0);
  expect(jumpTo(session, 2)).toBe(session);
});

// Acceptance 8: paused time is not training time.
it('leaves paused time out of the training time', () => {
  const start = fromWorkout(workout([{ id: 'a' }]), T0);
  const paused = pause(completeCurrent(start, T0 + sec(60)).session, T0 + sec(100));
  expect(paused.rest).toBeNull();

  const resumed = resume(paused, T0 + sec(400));
  expect(elapsedMs(paused, T0 + sec(300))).toBe(sec(100));
  expect(elapsedMs(resumed, T0 + sec(460))).toBe(sec(160));
});

it('asks in the summary about strength exercises finished without feedback', () => {
  const start = fromWorkout(workout([{ id: 'a', sets: 1 }, { id: 'b', sets: 1 }, { id: 'run', durationSec: 600, reps: null }]), T0);
  const done = doSets(start, 3);

  expect(awaitingFeedback(done).map((exercise) => exercise.itemId)).toEqual(['a', 'b']);
  expect(awaitingFeedback(setFeedback(done, 'a', 'easy')).map((exercise) => exercise.itemId)).toEqual(['b']);
});

it('marks a new record only against an earlier best', () => {
  const start = fromWorkout(
    workout([
      { id: 'beaten', sets: 1, best: 45, suggested: 47.5 },
      { id: 'first-time', sets: 1 },
    ]),
    T0,
  );
  const records = summary(doSets(start, 2)).exercises.map((entry) => entry.newRecord);

  expect(records).toEqual([true, false]);
});

it('restores a stored session but trusts the server for what was logged', () => {
  const stored = step(completeCurrent(fromWorkout(workout([{ id: 'a', sets: 1 }, { id: 'b' }]), T0), T0).session, 'weight', 1);
  // The server says set 1 of "a" never arrived.
  const fresh = fromWorkout(workout([{ id: 'a', sets: 1 }, { id: 'b' }]), T0 + sec(500));
  const restored = restore({ ...stored, currentIndex: 0 }, fresh);

  expect(restored.startedAt).toBe(T0);
  expect(restored.exercises[0].logs).toHaveLength(0);
  expect(restored.currentIndex).toBe(0);
  expect(restored.exercises[1].weightKg).toBe(42.5);
});

it('picks up exercises added or swapped while focus mode was away', () => {
  const stored = step(fromWorkout(workout([{ id: 'a' }, { id: 'b' }]), T0), 'weight', 1);
  const swapped = workout([{ id: 'a' }, { id: 'b' }, { id: 'c', weightKg: 20 }]);
  // "a" now holds a different exercise: replace-today keeps the item and changes what it is.
  swapped.items[0].item.exercise_id = 'ex-other';
  const restored = restore({ ...stored, exercises: stored.exercises.map((e, i) => (i === 1 ? { ...e, weightKg: 60 } : e)) }, fromWorkout(swapped, T0));

  expect(restored.exercises.map((exercise) => exercise.itemId)).toEqual(['a', 'b', 'c']);
  expect(restored.exercises[0].weightKg).toBe(40);
  expect(restored.exercises[1].weightKg).toBe(60);
  expect(restored.exercises[2].weightKg).toBe(20);
});

describe('warming up', () => {
  it('ramps to the working weight in 2.5 kg steps, and only for a weight worth warming up to', () => {
    expect(warmupPlan(60)).toEqual([
      { weightKg: 30, reps: 8 },
      { weightKg: 40, reps: 5 },
      { weightKg: 50, reps: 3 },
    ]);
    // 70% of 10 kg rounds down to the same 5 kg as half of it, so it is left out.
    expect(warmupPlan(10)).toEqual([
      { weightKg: 5, reps: 8 },
      { weightKg: 7.5, reps: 3 },
    ]);
    expect(warmupPlan(7.5)).toEqual([]);
    expect(warmupPlan(0)).toEqual([]);
    expect(warmupPlan(null)).toEqual([]);
  });

  it('comes before the first working set, logs nothing, and rests into the working sets', () => {
    let session = startSession(workout([{ id: 'squat', weightKg: 60, sets: 2 }]), T0);
    expect(currentWarmup(session.exercises[0])).toMatchObject({ number: 1, total: 3, set: { weightKg: 30, reps: 8 } });

    for (const number of [1, 2]) {
      const result = completeCurrent(session, T0);
      expect(result.log).toBeNull();
      expect(result.session.rest).toMatchObject({ totalSec: WARMUP_REST_SEC, nextIsNewExercise: false });
      session = skipRest(result.session);
      expect(currentWarmup(session.exercises[0])?.number).toBe(number + 1);
    }

    // The last warm-up leads into the first working set, with the full rest.
    const lastWarmup = completeCurrent(session, T0);
    expect(lastWarmup.log).toBeNull();
    expect(lastWarmup.session.rest?.totalSec).toBe(REST_SEC);
    session = skipRest(lastWarmup.session);
    expect(currentWarmup(session.exercises[0])).toBeNull();
    expect(finishedWarmups(session.exercises[0])).toHaveLength(3);

    const working = completeCurrent(session, T0);
    expect(working.log).toMatchObject({ setIndex: 0, weightKg: 60 });
    expect(working.session.exercises[0].logs).toHaveLength(1);
    expect(summary(working.session).sets).toBe(1);
  });

  it('follows the working weight on the stepper', () => {
    const session = step(startSession(workout([{ id: 'squat', weightKg: 60 }]), T0), 'weight', -1);
    expect(currentWarmup(session.exercises[0])?.set).toEqual({ weightKg: 27.5, reps: 8 });
  });

  it('is left out for bodyweight, timed or light work, and once a working set is logged', () => {
    const session = startSession(
      workout([
        { id: 'push-up', weightKg: null, equipment: 'bodyweight' },
        { id: 'run', durationSec: 600, reps: null, weightKg: null, equipment: null },
        { id: 'curl', weightKg: 7.5, equipment: 'dumbbell' },
        { id: 'squat', weightKg: 60, logs: [{ weight_kg: 60, reps_done: 8 }] },
      ]),
      T0,
    );

    expect(session.exercises.map(currentWarmup)).toEqual([null, null, null, null]);
  });

  it('can be skipped straight to the working sets', () => {
    const resting = completeCurrent(startSession(workout([{ id: 'squat', weightKg: 60 }]), T0), T0).session;
    const skipped = skipWarmup(resting);

    expect(skipped.rest).toBeNull();
    expect(currentWarmup(skipped.exercises[0])).toBeNull();
    expect(completeCurrent(skipped, T0).log).toMatchObject({ setIndex: 0, weightKg: 60 });
  });

  it('keeps its progress when focus mode comes back', () => {
    const planned = workout([{ id: 'squat', weightKg: 60 }]);
    const stored = skipRest(completeCurrent(startSession(planned, T0), T0).session);
    const restored = restore(stored, startSession(planned, T0 + sec(300)));

    expect(currentWarmup(restored.exercises[0])?.number).toBe(2);
  });
});
