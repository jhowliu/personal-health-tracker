import { I18n, type TranslateOptions } from 'i18n-js';

import { catalogs, type MessageKey, type SupportedLocale } from './index';
import { DEFAULT_LOCALE } from './runtime-core';

const i18n = new I18n(catalogs, {
  defaultLocale: DEFAULT_LOCALE,
  enableFallback: true,
});

let activeLocale: SupportedLocale = DEFAULT_LOCALE;
i18n.locale = activeLocale;

export type TranslationValues = TranslateOptions;

export function activateLocale(locale: SupportedLocale) {
  activeLocale = locale;
  i18n.locale = locale;
}

/** Translation access for non-React code such as the API client and notifications. */
export function translate(key: MessageKey, values?: TranslationValues): string {
  return i18n.t(key, values);
}

export function getActiveLocale(): SupportedLocale {
  return activeLocale;
}
