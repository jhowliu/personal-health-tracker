/** Time zones: the phone's own, and the short list offered on the settings screen. */

const FALLBACK = 'Asia/Taipei';

/** The IANA name the phone is set to, e.g. "Asia/Tokyo". */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export const COMMON_TIMEZONES: { id: string; label: string }[] = [
  { id: 'Asia/Taipei', label: '台北' },
  { id: 'Asia/Tokyo', label: '東京' },
  { id: 'Asia/Seoul', label: '首爾' },
  { id: 'Asia/Hong_Kong', label: '香港' },
  { id: 'Asia/Singapore', label: '新加坡' },
  { id: 'Asia/Bangkok', label: '曼谷' },
  { id: 'Australia/Brisbane', label: '布里斯本' },
  { id: 'Australia/Sydney', label: '雪梨' },
  { id: 'Pacific/Auckland', label: '奧克蘭' },
  { id: 'Europe/London', label: '倫敦' },
  { id: 'Europe/Paris', label: '巴黎' },
  { id: 'America/New_York', label: '紐約' },
  { id: 'America/Chicago', label: '芝加哥' },
  { id: 'America/Los_Angeles', label: '洛杉磯' },
  { id: 'America/Vancouver', label: '溫哥華' },
];

export function timezoneLabel(id: string): string {
  const known = COMMON_TIMEZONES.find((zone) => zone.id === id);
  return known ? `${known.label}(${id})` : id;
}
