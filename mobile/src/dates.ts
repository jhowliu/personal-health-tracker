/** Calendar days as `YYYY-MM-DD` strings in the device's local time zone. */

const pad = (value: number) => String(value).padStart(2, '0');

function format(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return format(new Date());
}

/** `iso` moved by whole days; negative goes back. */
export function shiftDay(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return format(date);
}

/** How copy names a day: 今天, 昨天, or a date such as 9/28. */
export function dayWord(iso: string) {
  const today = todayISO();
  if (iso === today) return '今天';
  if (iso === shiftDay(today, -1)) return '昨天';
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}
