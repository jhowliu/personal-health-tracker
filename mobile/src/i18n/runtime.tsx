import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { LocalePreference, SupportedLocale } from './index';
import {
  isLocalePreference,
  LOCALE_PREFERENCE_STORAGE_KEY,
  resolveLocale,
} from './runtime-core';
import { activateLocale, translate } from './translator';

type I18nContextValue = {
  locale: SupportedLocale;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => Promise<void>;
  t: typeof translate;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const deviceLocales = useLocales();
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [ready, setReady] = useState(false);
  const locale = resolveLocale(preference, deviceLocales);

  // The shared translator must be current before children can start requests or notifications.
  activateLocale(locale);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY)
      .then((stored) => {
        if (live && isLocalePreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.title = translate('common.appName');
    }
  }, [locale]);

  const setPreference = useCallback(
    async (next: LocalePreference) => {
      activateLocale(resolveLocale(next, deviceLocales));
      setPreferenceState(next);
      await AsyncStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, next);
    },
    [deviceLocales],
  );

  const value = useMemo(
    () => ({ locale, preference, setPreference, t: translate }),
    [locale, preference, setPreference],
  );

  if (!ready) return null;
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nContextValue {
  const context = use(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
