import {
  DEFAULT_LOCALE,
  intlLocale,
  isLocalePreference,
  resolveLocale,
  resolveSystemLocale,
} from './runtime-core';

const deviceLocale = (languageTag: string, languageCode: string | null = null) => ({
  languageCode,
  languageTag,
});

describe('locale resolution', () => {
  it('uses the first supported device language', () => {
    expect(
      resolveSystemLocale([
        deviceLocale('fr-FR', 'fr'),
        deviceLocale('en-AU', 'en'),
        deviceLocale('zh-Hant-TW', 'zh'),
      ]),
    ).toBe('en');
  });

  it('normalises every Chinese device locale to Traditional Chinese', () => {
    expect(resolveSystemLocale([deviceLocale('zh-Hans-CN', 'zh')])).toBe('zh-TW');
  });

  it('falls back to Traditional Chinese for unsupported device languages', () => {
    expect(resolveSystemLocale([deviceLocale('fr-FR', 'fr')])).toBe(DEFAULT_LOCALE);
  });

  it('lets an explicit preference override the device', () => {
    expect(resolveLocale('zh-TW', [deviceLocale('en-US', 'en')])).toBe('zh-TW');
    expect(resolveLocale('en', [deviceLocale('zh-TW', 'zh')])).toBe('en');
  });

  it('accepts only persisted preference values', () => {
    expect(['system', 'zh-TW', 'en'].every(isLocalePreference)).toBe(true);
    expect(isLocalePreference('en-AU')).toBe(false);
    expect(isLocalePreference(null)).toBe(false);
  });

  it('uses Australian English formatting without changing the app locale', () => {
    expect(intlLocale('en')).toBe('en-AU');
    expect(intlLocale('zh-TW')).toBe('zh-TW');
  });
});
