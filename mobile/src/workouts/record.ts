/**
 * An exercise's record for a day, edited as a whole after the fact: 補記, 直接記錄, or fixing
 * what was logged. Rows are what the fields hold, as typed; toRecords turns them into the
 * sets the server keeps, or says what is wrong with them.
 */
import type { Schema } from '@/api/client';

type Entry = Schema<'WorkoutExecutionItemOut'>;
export type Effort = 'easy' | 'appropriate' | 'hard';
export type RecordRow = {
  reps: string;
  weight: string;
  minutes: string;
  /** A treadmill's settings, optional: given, they cost the walk by speed and incline. */
  speed: string;
  incline: string;
  effort: Effort | null;
};

export const isTimed = (entry: Entry) => entry.item.duration_sec !== null;
export const isTreadmill = (entry: Entry) => entry.item.equipment === 'treadmill';

const firstNumber = (text: string | null | undefined) => {
  const match = text?.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const shown = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

/** What is already logged, one row per set. */
export function rowsFromLogs(entry: Entry): RecordRow[] {
  return entry.logs.map((log) => ({
    reps: shown(log.reps_done),
    weight: shown(log.weight_kg),
    minutes: log.duration_sec ? String(Math.max(1, Math.round(log.duration_sec / 60))) : '',
    speed: shown(log.speed_kmh),
    incline: shown(log.incline_pct),
    effort: (log.effort as Effort | null) ?? null,
  }));
}

/**
 * The next set to add: a copy of the one before it, or for the first one the same starting
 * point focus mode uses — earlier days' suggestion or last reps, then the prescription.
 */
export function nextRow(entry: Entry, rows: RecordRow[]): RecordRow {
  const before = rows[rows.length - 1];
  if (before) return { ...before, effort: null };
  const { item } = entry;
  const weight = item.equipment === 'bodyweight' ? null : (entry.suggested_weight_kg ?? item.weight_kg);
  return {
    reps: shown(entry.last_set?.reps_done ?? firstNumber(item.reps) ?? 10),
    weight: shown(weight),
    minutes: String(Math.max(1, Math.round((item.duration_sec ?? 60) / 60))),
    // The last walk's settings carry over; the first time they are left for the user.
    speed: isTreadmill(entry) ? shown(entry.last_set?.speed_kmh) : '',
    incline: isTreadmill(entry) ? shown(entry.last_set?.incline_pct) : '',
    effort: null,
  };
}

/** Every set the prescription asks for, filled in as prescribed. */
export function prescribedRows(entry: Entry): RecordRow[] {
  const count = isTimed(entry) ? 1 : Math.max(1, entry.item.sets ?? 1);
  const first = nextRow(entry, []);
  return Array.from({ length: count }, () => ({ ...first }));
}

/** The rows as the server's sets, or the first thing wrong with them, in words. */
export function toRecords(
  entry: Entry,
  rows: RecordRow[],
): { sets: Schema<'SetRecordIn'>[] } | { error: string } {
  const timed = isTimed(entry);
  const sets: Schema<'SetRecordIn'>[] = [];
  for (const [index, row] of rows.entries()) {
    const which = timed ? '時間' : `第 ${index + 1} 組`;
    if (timed) {
      const minutes = Number(row.minutes);
      if (!/^\d+$/.test(row.minutes.trim()) || minutes < 1) return { error: `${which}要填 1 以上的整數分鐘` };
      const speed = optionalNumber(row.speed);
      if (speed === undefined || (speed !== null && (speed <= 0 || speed > 30))) {
        return { error: '速度要填 30 以內的 km/h' };
      }
      const incline = optionalNumber(row.incline);
      if (incline === undefined || (incline !== null && (incline < 0 || incline > 40))) {
        return { error: '坡度要填 0 到 40 的 %' };
      }
      sets.push({
        duration_sec: minutes * 60,
        effort: row.effort,
        ...(speed !== null ? { speed_kmh: speed, incline_pct: incline ?? 0 } : {}),
      });
      continue;
    }
    const reps = Number(row.reps);
    if (!/^\d+$/.test(row.reps.trim()) || reps < 1) return { error: `${which}的次數要填 1 以上的整數` };
    const weightText = row.weight.trim();
    const weight = Number(weightText);
    if (weightText && (!Number.isFinite(weight) || weight < 0)) return { error: `${which}的重量要是數字` };
    sets.push({ reps_done: reps, weight_kg: weightText ? weight : null, effort: row.effort });
  }
  return { sets };
}

/** A field left blank is null; one that is not a number is undefined. */
function optionalNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}
