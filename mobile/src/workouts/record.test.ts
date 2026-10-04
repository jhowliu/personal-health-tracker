import type { Schema } from '@/api/client';
import { nextRow, prescribedRows, rowsFromLogs, toRecords, type RecordRow } from '@/workouts/record';

type Entry = Schema<'WorkoutExecutionItemOut'>;

function entry(spec: {
  sets?: number | null;
  reps?: string | null;
  durationSec?: number | null;
  weightKg?: number | null;
  equipment?: string | null;
  suggested?: number | null;
  lastReps?: number | null;
  lastSpeed?: number | null;
  lastIncline?: number | null;
  logs?: Partial<Schema<'SetLogOut'>>[];
}): Entry {
  return {
    item: {
      id: 'item',
      exercise_id: 'curl',
      exercise_name: '啞鈴二頭彎舉',
      sort_order: 0,
      sets: spec.sets === undefined ? 3 : spec.sets,
      reps: spec.reps === undefined ? '10-12' : spec.reps,
      duration_sec: spec.durationSec ?? null,
      weight_kg: spec.weightKg ?? null,
      rest_sec: 60,
      note: null,
      equipment: spec.equipment ?? 'dumbbell',
    },
    logs: (spec.logs ?? []).map((log, index) => ({
      day_workout_item_id: 'item',
      exercise_id: 'curl',
      set_index: index,
      reps_done: null,
      duration_sec: null,
      weight_kg: null,
      effort: null,
      done_at: '2026-10-04T00:00:00Z',
      ...log,
    })),
    completed_set_count: spec.logs?.length ?? 0,
    last_set:
      spec.lastReps || spec.lastSpeed
        ? {
            date: '2026-10-01',
            weight_kg: 8,
            reps_done: spec.lastReps ?? null,
            duration_sec: null,
            effort: null,
            speed_kmh: spec.lastSpeed ?? null,
            incline_pct: spec.lastIncline ?? null,
          }
        : null,
    best_weight_kg: null,
    suggested_weight_kg: spec.suggested ?? null,
  } as unknown as Entry;
}

const row = (reps: string, weight = '', effort: RecordRow['effort'] = null): RecordRow => ({
  reps,
  weight,
  minutes: '1',
  speed: '',
  incline: '',
  effort,
});

describe('an exercise record', () => {
  it('reads back what was logged, one row per set', () => {
    const rows = rowsFromLogs(entry({ logs: [{ reps_done: 12, weight_kg: 8 }, { reps_done: 10, weight_kg: 9, effort: 'hard' }] }));
    expect(rows.map(({ reps, weight, effort }) => [reps, weight, effort])).toEqual([
      ['12', '8', null],
      ['10', '9', 'hard'],
    ]);
  });

  it('starts a first set from the suggestion and last reps, then copies the set before', () => {
    const first = nextRow(entry({ suggested: 10, weightKg: 8, lastReps: 11 }), []);
    expect(first).toMatchObject({ reps: '11', weight: '10' });
    expect(nextRow(entry({}), [row('9', '7.5', 'easy')])).toEqual(row('9', '7.5'));
  });

  it('leaves bodyweight work without a weight and falls back to the prescribed reps', () => {
    expect(nextRow(entry({ equipment: 'bodyweight', weightKg: 5, reps: '8-10' }), [])).toMatchObject({ reps: '8', weight: '' });
  });

  it('fills every prescribed set, or one stretch of time', () => {
    expect(prescribedRows(entry({ sets: 4 }))).toHaveLength(4);
    expect(prescribedRows(entry({ durationSec: 600, reps: null, sets: null }))).toEqual([
      { reps: '10', weight: '', minutes: '10', speed: '', incline: '', effort: null },
    ]);
  });

  it('sends reps, an optional weight, and the effort it was given', () => {
    expect(toRecords(entry({}), [row('12', '8'), row('10', '', 'easy')])).toEqual({
      sets: [
        { reps_done: 12, weight_kg: 8, effort: null },
        { reps_done: 10, weight_kg: null, effort: 'easy' },
      ],
    });
  });

  it('sends timed work as seconds', () => {
    expect(toRecords(entry({ durationSec: 600, reps: null }), [{ ...row(''), minutes: '12' }])).toEqual({
      sets: [{ duration_sec: 720, effort: null }],
    });
  });

  it('names the first set that cannot be saved', () => {
    expect(toRecords(entry({}), [row('12'), row('abc')])).toEqual({ error: '第 2 組的次數要填 1 以上的整數' });
    expect(toRecords(entry({}), [row('12', 'x')])).toEqual({ error: '第 1 組的重量要是數字' });
    expect(toRecords(entry({ durationSec: 600 }), [{ ...row(''), minutes: '0' }])).toEqual({
      error: '時間要填 1 以上的整數分鐘',
    });
  });

  it('carries a treadmill walk\'s last speed and incline, and sends them', () => {
    const walk = entry({ durationSec: 600, reps: null, sets: null, equipment: 'treadmill', lastSpeed: 4, lastIncline: 10 });
    const [first] = prescribedRows(walk);
    expect(first).toMatchObject({ minutes: '10', speed: '4', incline: '10' });
    expect(toRecords(walk, [first])).toEqual({
      sets: [{ duration_sec: 600, effort: null, speed_kmh: 4, incline_pct: 10 }],
    });
  });

  it('leaves speed and incline out when they are blank, and reads a blank incline as level', () => {
    const walk = entry({ durationSec: 600, reps: null, sets: null, equipment: 'treadmill' });
    const [first] = prescribedRows(walk);
    expect(toRecords(walk, [first])).toEqual({ sets: [{ duration_sec: 600, effort: null }] });
    expect(toRecords(walk, [{ ...first, speed: '5' }])).toEqual({
      sets: [{ duration_sec: 600, effort: null, speed_kmh: 5, incline_pct: 0 }],
    });
  });

  it('rejects a speed or incline no treadmill has', () => {
    const walk = entry({ durationSec: 600, reps: null, sets: null, equipment: 'treadmill' });
    const [first] = prescribedRows(walk);
    expect(toRecords(walk, [{ ...first, speed: '40' }])).toEqual({ error: '速度要填 30 以內的 km/h' });
    expect(toRecords(walk, [{ ...first, speed: '5', incline: 'x' }])).toEqual({ error: '坡度要填 0 到 40 的 %' });
  });
});
