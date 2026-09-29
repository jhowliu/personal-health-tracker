/**
 * Which moments the morning weigh-in reminder should fire at. Pure on purpose: no React
 * Native, no Expo, so the rules are easy to reason about and to check on their own.
 */

/**
 * The reminder is scheduled as one-off notifications for the next few days rather than a
 * repeating one, because a repeating notification cannot skip a single day. The window is
 * refreshed every time the app opens, so it only runs dry after this many days away.
 */
export const REMINDER_WINDOW_DAYS = 14;

export function parseReminderTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** The local calendar date as YYYY-MM-DD, which is how the API names a day. */
export function localDateISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The times to schedule, in local time, starting from `now`.
 *
 * A time that has already passed is left out, and so is today's when the weigh-in is
 * already logged.
 */
export function reminderDates(
  now: Date,
  time: string,
  loggedToday: boolean,
  days: number = REMINDER_WINDOW_DAYS,
): Date[] {
  const parsed = parseReminderTime(time);
  if (!parsed) return [];

  const dates: Date[] = [];
  for (let offset = 0; offset < days; offset++) {
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      parsed.hour,
      parsed.minute,
      0,
      0,
    );
    if (at.getTime() <= now.getTime()) continue;
    if (offset === 0 && loggedToday) continue;
    dates.push(at);
  }
  return dates;
}
