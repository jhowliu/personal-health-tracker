/**
 * An exercise's target for the day — sets and reps or minutes, weight, rest, note — as typed
 * into the fields, and what is sent back for it.
 */
import type { Schema } from '@/api/client';

type Entry = Schema<'WorkoutExecutionItemOut'>;

export type TargetEdit = { sets: string; reps: string; durationMin: string; weight: string; rest: string; note: string };

/** The fields as they stand before anything is typed. */
export function targetFromItem(entry: Entry): TargetEdit {
  const prescribed = entry.item;
  return {
    sets: String(prescribed.sets ?? ''),
    reps: prescribed.reps ?? '',
    durationMin: prescribed.duration_sec ? String(Math.round(prescribed.duration_sec / 60)) : '',
    weight: prescribed.weight_kg === null ? '' : String(prescribed.weight_kg),
    rest: String(prescribed.rest_sec),
    note: prescribed.note ?? '',
  };
}

const WHOLE = /^\d+$/;
// 12, or a range such as 10-12; templates write the range with an en dash too.
const REPS = /^\d+(\s*[-–~]\s*\d+)?$/;

/** What is wrong with an exercise's edited target, in words, or null when it can be saved. */
export function targetError(entry: Entry, edit: TargetEdit): string | null {
  if (entry.item.duration_sec) {
    if (!WHOLE.test(edit.durationMin.trim()) || Number(edit.durationMin) < 1) return '的目標時間要填 1 以上的整數分鐘';
  } else {
    if (!WHOLE.test(edit.sets.trim()) || Number(edit.sets) < 1) return '的組數要填 1 以上的整數';
    if (!REPS.test(edit.reps.trim())) return '的次數要填數字或範圍，例如 12 或 10-12';
  }
  if (edit.weight.trim() && !(Number(edit.weight) >= 0)) return '的重量要是數字';
  if (edit.rest.trim() && !WHOLE.test(edit.rest.trim())) return '的休息要填整數秒';
  return null;
}

export function targetChanges(entry: Entry, edit: TargetEdit) {
  const common = {
    weight_kg: edit.weight.trim() ? Number(edit.weight) : null,
    rest_sec: Number(edit.rest) || 0,
    note: edit.note.trim() || null,
  };
  return entry.item.duration_sec
    ? { ...common, duration_sec: Number(edit.durationMin) * 60 }
    : { ...common, sets: Number(edit.sets), reps: edit.reps.trim() };
}
