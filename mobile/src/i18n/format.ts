import type { SupportedLocale } from './types';
import { getActiveLocale } from './translator';
import { intlLocale } from './runtime-core';

export function formatNumber(value: number, locale: SupportedLocale = getActiveLocale()): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatDate(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions,
  locale: SupportedLocale = getActiveLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(value));
}
