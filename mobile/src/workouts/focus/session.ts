/**
 * Focus mode's state: one workout session on today's date, as pure functions.
 *
 * The server owns the logged sets; this owns what only the phone knows — when the session
 * started and paused, the running rest, which exercise is on screen, and the stepper
 * values for the next set. Every function takes `now` instead of reading the clock, so a
 * rest that ran out while the app was in the background works out the same as one watched
 * to the end, and tests can say what time it is.
 *
 * See docs/focus-mode-spec.md, sections 4–6 and 10.
 */
import type { Schema } from '@/api/client';

type Workout = Schema<'WorkoutExecutionOut'>;
export type Effort = 'easy' | 'appropriate' | 'hard';

/** Rest is fixed (spec §10); the user nudges it in 30-second steps while resting. */
export const REST_SEC = 90;
export const REST_STEP_SEC = 30;
export const WEIGHT_STEP_KG = 2.5;
/** A treadmill's speed and incline start here when first touched, and move this much. */
export const SPEED_FROM_KMH = 5;
export const SPEED_STEP_KMH = 0.5;
export const INCLINE_STEP_PCT = 1;

export type SetRecord = { weightKg: number | null; reps: number };

export type FocusExercise = {
  itemId: string;
  exerciseId: string;
  name: string;
  /** 'time' is cardio and holds alike: minutes, done once, no rest after (spec §10). */
  kind: 'sets' | 'time';
  plannedSets: number;
  repsLabel: string | null;
  targetMin: number;
  logs: SetRecord[];
  timeDone: boolean;
  /** Stepper values for the next set; weight is null for bodyweight work, which hides it. */
  weightKg: number | null;
  reps: number;
  minutes: number;
  /**
   * A treadmill's settings, null until given: then the exercise's own MET costs it rather
   * than a speed and incline nobody chose. Only a treadmill gets the two steppers.
   */
  treadmill: boolean;
  speedKmh: number | null;
  inclinePct: number | null;
  /** Heaviest weight on earlier days, for the summary's 新紀錄. */
  bestWeightKg: number | null;
  /** The last set on an earlier day, for 「上次 45 kg × 12，已帶入」; null the first time. */
  last: { weightKg: number | null; reps: number | null; effort: Effort | null } | null;
  suggestedWeightKg: number | null;
  /** How the whole exercise felt, asked once it is done. */
  feedback: Effort | null;
};

export type Rest = {
  endsAt: number;
  totalSec: number;
  /** The rest leads into another exercise, so the screen says 下一個動作 and asks for feedback. */
  nextIsNewExercise: boolean;
  /** The exercise just finished, whose feedback the rest screen asks for; null mid-exercise. */
  finishedItemId: string | null;
};

export type Session = {
  date: string;
  startedAt: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  currentIndex: number;
  exercises: FocusExercise[];
  rest: Rest | null;
};

/** What a completed set means for the server: one log to PUT. */
export type SetToLog = {
  itemId: string;
  exerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
};

export const isDone = (exercise: FocusExercise) =>
  exercise.kind === 'time' ? exercise.timeDone : exercise.logs.length >= exercise.plannedSets;

export const isFinished = (session: Session) => session.exercises.every(isDone);

/** The first unfinished exercise after `from`, wrapping round; -1 once everything is done. */
export function nextIndex(exercises: FocusExercise[], from: number): number {
  for (let step = 1; step <= exercises.length; step += 1) {
    const index = (from + step) % exercises.length;
    if (!isDone(exercises[index])) return index;
  }
  return -1;
}

/**
 * The exercise after the one on screen, or -1 when this is the last still to do. nextIndex
 * wraps round to the current exercise while it is unfinished, which is not a next one.
 */
export function upNext(session: Session): number {
  const next = nextIndex(session.exercises, session.currentIndex);
  return next === session.currentIndex ? -1 : next;
}

const firstNumber = (text: string | null | undefined) => {
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : null;
};

/** Today's prescription, today's logged sets, and earlier days' history, as a fresh session. */
export function fromWorkout(workout: Workout, now: number): Session {
  const exercises = workout.items.map(({ item, logs, last_set, best_weight_kg, suggested_weight_kg }) => {
    const kind: FocusExercise['kind'] = item.duration_sec ? 'time' : 'sets';
    const latest = logs[logs.length - 1];
    const targetMin = Math.max(1, Math.round((item.duration_sec ?? 60) / 60));
    // Carry on from today's last set; otherwise from earlier days, nudged by how it felt;
    // otherwise from the prescription. Only bodyweight work goes without a weight: a lift
    // whose plan left it blank (the built-in templates do) starts from 0.
    const bodyweight = item.equipment === 'bodyweight';
    const weightKg = bodyweight ? null : (latest?.weight_kg ?? suggested_weight_kg ?? item.weight_kg ?? 0);
    const reps = latest?.reps_done ?? last_set?.reps_done ?? firstNumber(item.reps) ?? 10;
    const treadmill = item.equipment === 'treadmill';
    return {
      itemId: item.id,
      exerciseId: item.exercise_id,
      name: item.exercise_name,
      kind,
      plannedSets: kind === 'time' ? 1 : Math.max(1, item.sets ?? 1),
      repsLabel: item.reps ?? null,
      targetMin,
      logs: kind === 'time' ? [] : logs.map((log) => ({ weightKg: log.weight_kg, reps: log.reps_done ?? 0 })),
      timeDone: kind === 'time' && logs.length > 0,
      weightKg,
      reps: Math.max(1, reps),
      minutes: latest?.duration_sec ? Math.max(1, Math.round(latest.duration_sec / 60)) : targetMin,
      treadmill,
      speedKmh: treadmill ? (latest?.speed_kmh ?? last_set?.speed_kmh ?? null) : null,
      inclinePct: treadmill ? (latest?.incline_pct ?? last_set?.incline_pct ?? null) : null,
      bestWeightKg: best_weight_kg ?? null,
      last: last_set
        ? { weightKg: last_set.weight_kg, reps: last_set.reps_done, effort: (last_set.effort as Effort | null) ?? null }
        : null,
      suggestedWeightKg: suggested_weight_kg ?? null,
      feedback: null,
    } satisfies FocusExercise;
  });
  const first = exercises.findIndex((exercise) => !isDone(exercise));
  return {
    date: workout.date,
    startedAt: now,
    pausedAt: null,
    pausedTotalMs: 0,
    currentIndex: Math.max(0, first),
    exercises,
    rest: null,
  };
}

/**
 * A stored session brought up to date with the server's logs, which win: sets logged from
 * another screen count, and a set the phone never managed to send does not. Exercises added
 * meanwhile join in; one swapped for another (same item, new exercise) starts afresh rather
 * than keeping the old exercise's weight.
 */
export function restore(stored: Session, fresh: Session): Session {
  const kept = new Map(stored.exercises.map((exercise) => [exercise.itemId, exercise]));
  const exercises = fresh.exercises.map((exercise) => {
    const before = kept.get(exercise.itemId);
    return before && before.exerciseId === exercise.exerciseId
      ? {
          ...exercise,
          weightKg: before.weightKg,
          reps: before.reps,
          minutes: before.minutes,
          // A session stored by an older version has neither.
          speedKmh: before.speedKmh ?? exercise.speedKmh,
          inclinePct: before.inclinePct ?? exercise.inclinePct,
          feedback: before.feedback,
        }
      : exercise;
  });
  const merged = { ...stored, exercises, currentIndex: Math.min(stored.currentIndex, exercises.length - 1) };
  const current = merged.exercises[merged.currentIndex];
  if (current && isDone(current)) {
    const next = nextIndex(merged.exercises, merged.currentIndex);
    return { ...merged, currentIndex: next === -1 ? merged.currentIndex : next };
  }
  return merged;
}

const replaceAt = (exercises: FocusExercise[], index: number, exercise: FocusExercise) =>
  exercises.map((candidate, i) => (i === index ? exercise : candidate));

/**
 * The main button: log the current set (or the timed exercise) and move on. Rests follow a
 * set when another set, or another strength exercise, comes next; never after the last set
 * of the day, and never after cardio (spec §5).
 */
export function completeCurrent(
  session: Session,
  now: number,
): { session: Session; log: SetToLog; finished: boolean } {
  const index = session.currentIndex;
  const exercise = session.exercises[index];
  const log: SetToLog =
    exercise.kind === 'time'
      ? {
          itemId: exercise.itemId,
          exerciseId: exercise.exerciseId,
          setIndex: 0,
          weightKg: null,
          reps: null,
          durationSec: exercise.minutes * 60,
          speedKmh: exercise.speedKmh,
          inclinePct: exercise.inclinePct,
        }
      : {
          itemId: exercise.itemId,
          exerciseId: exercise.exerciseId,
          setIndex: exercise.logs.length,
          weightKg: exercise.weightKg,
          reps: exercise.reps,
          durationSec: null,
          speedKmh: null,
          inclinePct: null,
        };
  const updated: FocusExercise =
    exercise.kind === 'time'
      ? { ...exercise, timeDone: true }
      : { ...exercise, logs: [...exercise.logs, { weightKg: exercise.weightKg, reps: exercise.reps }] };
  const exercises = replaceAt(session.exercises, index, updated);

  if (!isDone(updated)) {
    const rest = startRest(now, false, null);
    return { session: { ...session, exercises, rest }, log, finished: false };
  }
  const next = nextIndex(exercises, index);
  if (next === -1) {
    return { session: { ...session, exercises, rest: null }, log, finished: true };
  }
  const restBefore = updated.kind === 'sets' && exercises[next].kind === 'sets';
  return {
    session: {
      ...session,
      exercises,
      currentIndex: next,
      rest: restBefore ? startRest(now, true, updated.itemId) : null,
    },
    log,
    finished: false,
  };
}

const startRest = (now: number, nextIsNewExercise: boolean, finishedItemId: string | null): Rest => ({
  endsAt: now + REST_SEC * 1000,
  totalSec: REST_SEC,
  nextIsNewExercise,
  finishedItemId,
});

/** −30 / +30 seconds. Taking off more than is left ends the rest. */
export function adjustRest(session: Session, deltaSec: number, now: number): Session {
  const rest = session.rest;
  if (!rest) return session;
  const endsAt = rest.endsAt + deltaSec * 1000;
  if (endsAt <= now) return { ...session, rest: null };
  return { ...session, rest: { ...rest, endsAt, totalSec: Math.max(1, rest.totalSec + deltaSec) } };
}

export const skipRest = (session: Session): Session => ({ ...session, rest: null });

/** Ends a rest whose time is up — on each tick, and when the app comes back to the front. */
export function settleRest(session: Session, now: number): Session {
  return session.rest && now >= session.rest.endsAt ? { ...session, rest: null } : session;
}

export const restLeftSec = (session: Session, now: number) =>
  session.rest ? Math.max(0, Math.ceil((session.rest.endsAt - now) / 1000)) : 0;

/** Time spent training: from the start to now (or to the pause), less earlier pauses. */
export const elapsedMs = (session: Session, now: number) =>
  (session.pausedAt ?? now) - session.startedAt - session.pausedTotalMs;

/** 暫停並離開: the clock stops and the rest is dropped (its alarm is cancelled by the caller). */
export const pause = (session: Session, now: number): Session =>
  session.pausedAt === null ? { ...session, pausedAt: now, rest: null } : session;

export function resume(session: Session, now: number): Session {
  if (session.pausedAt === null) return session;
  return { ...session, pausedAt: null, pausedTotalMs: session.pausedTotalMs + (now - session.pausedAt) };
}

/** Pick another exercise from the list, say when the machine is taken. Done ones stay done. */
export function jumpTo(session: Session, index: number): Session {
  const target = session.exercises[index];
  if (!target || isDone(target)) return session;
  return { ...session, currentIndex: index, rest: null };
}

export type Stepper = 'weight' | 'reps' | 'minutes' | 'speed' | 'incline';

/** The steppers act on the exercise on screen, which during a rest is the one coming up. */
export function step(session: Session, stepper: Stepper, direction: 1 | -1): Session {
  const index = session.currentIndex;
  const exercise = session.exercises[index];
  const updated =
    stepper === 'weight'
      ? exercise.weightKg === null
        ? exercise
        : { ...exercise, weightKg: Math.max(0, exercise.weightKg + direction * WEIGHT_STEP_KG) }
      : stepper === 'reps'
        ? { ...exercise, reps: Math.max(1, exercise.reps + direction) }
        : stepper === 'minutes'
          ? { ...exercise, minutes: Math.max(1, exercise.minutes + direction) }
          : !exercise.treadmill
            ? exercise
            : stepper === 'speed'
              ? {
                  ...exercise,
                  speedKmh: clamp((exercise.speedKmh ?? SPEED_FROM_KMH) + direction * SPEED_STEP_KMH, SPEED_STEP_KMH, 30),
                }
              : { ...exercise, inclinePct: clamp((exercise.inclinePct ?? 0) + direction * INCLINE_STEP_PCT, 0, 40) };
  return { ...session, exercises: replaceAt(session.exercises, index, updated) };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function setFeedback(session: Session, itemId: string, effort: Effort): Session {
  return {
    ...session,
    exercises: session.exercises.map((exercise) =>
      exercise.itemId === itemId ? { ...exercise, feedback: effort } : exercise,
    ),
  };
}

/** Strength exercises finished without feedback, for the summary to ask about. */
export const awaitingFeedback = (session: Session) =>
  session.exercises.filter((exercise) => exercise.kind === 'sets' && isDone(exercise) && !exercise.feedback);

export function summary(session: Session) {
  const strength = session.exercises.filter((exercise) => exercise.kind === 'sets');
  return {
    sets: strength.reduce((count, exercise) => count + exercise.logs.length, 0),
    volumeKg: strength.reduce(
      (total, exercise) => total + exercise.logs.reduce((sum, log) => sum + (log.weightKg ?? 0) * log.reps, 0),
      0,
    ),
    exercises: session.exercises.map((exercise) => ({
      exercise,
      // Only against an earlier best: a first attempt has nothing to beat.
      newRecord:
        exercise.bestWeightKg !== null &&
        exercise.logs.some((log) => log.weightKg !== null && log.weightKg > exercise.bestWeightKg!),
    })),
  };
}
