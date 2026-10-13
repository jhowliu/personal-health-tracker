/** Time zones: the phone's own, and the short list offered on the settings screen. */

import type { MessageKey } from '@/i18n';
import { translate } from '@/i18n/translator';

const FALLBACK = 'Asia/Taipei';

/** The IANA name the phone is set to, e.g. "Asia/Tokyo". */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export const COMMON_TIMEZONES: { id: string; labelKey: MessageKey }[] = [
  { id: 'Asia/Taipei', labelKey: 'timezone.cities.taipei' },
  { id: 'Asia/Tokyo', labelKey: 'timezone.cities.tokyo' },
  { id: 'Asia/Seoul', labelKey: 'timezone.cities.seoul' },
  { id: 'Asia/Hong_Kong', labelKey: 'timezone.cities.hongKong' },
  { id: 'Asia/Singapore', labelKey: 'timezone.cities.singapore' },
  { id: 'Asia/Bangkok', labelKey: 'timezone.cities.bangkok' },
  { id: 'Australia/Brisbane', labelKey: 'timezone.cities.brisbane' },
  { id: 'Australia/Sydney', labelKey: 'timezone.cities.sydney' },
  { id: 'Pacific/Auckland', labelKey: 'timezone.cities.auckland' },
  { id: 'Europe/London', labelKey: 'timezone.cities.london' },
  { id: 'Europe/Paris', labelKey: 'timezone.cities.paris' },
  { id: 'America/New_York', labelKey: 'timezone.cities.newYork' },
  { id: 'America/Chicago', labelKey: 'timezone.cities.chicago' },
  { id: 'America/Los_Angeles', labelKey: 'timezone.cities.losAngeles' },
  { id: 'America/Vancouver', labelKey: 'timezone.cities.vancouver' },
];

export function timezoneLabel(id: string, t: typeof translate = translate): string {
  const known = COMMON_TIMEZONES.find((zone) => zone.id === id);
  return known ? `${t(known.labelKey)} (${id})` : id;
}
