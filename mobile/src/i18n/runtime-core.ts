import type { LocalePreference, SupportedLocale } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'zh-TW';
export const LOCALE_PREFERENCE_STORAGE_KEY = 'pht.locale-preference';

export type DeviceLocale = {
  languageCode: string | null;
  languageTag: string;
};

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'zh-TW' || value === 'en';
}

export function resolveSystemLocale(locales: readonly DeviceLocale[]): SupportedLocale {
  for (const locale of locales) {
    const language = locale.languageCode?.toLowerCase() ?? locale.languageTag.split('-')[0]?.toLowerCase();
    if (language === 'en') return 'en';
    if (language === 'zh') return 'zh-TW';
  }
  return DEFAULT_LOCALE;
}

export function resolveLocale(
  preference: LocalePreference,
  locales: readonly DeviceLocale[],
): SupportedLocale {
  return preference === 'system' ? resolveSystemLocale(locales) : preference;
}

export function intlLocale(locale: SupportedLocale): string {
  return locale === 'en' ? 'en-AU' : 'zh-TW';
}
