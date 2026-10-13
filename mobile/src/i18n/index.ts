import { en } from "./locales/en";
import { zhTW } from "./locales/zh-TW";
import type {
  SupportedLocale,
  TranslationKey,
  TranslationShape,
} from "./types";

export type TranslationCatalog = TranslationShape<typeof zhTW>;
export type MessageKey = TranslationKey<typeof zhTW>;

export const catalogs = {
  "zh-TW": zhTW,
  en,
} as const satisfies Record<SupportedLocale, TranslationCatalog>;

export { SUPPORTED_LOCALES } from "./types";
export type { LocalePreference, SupportedLocale } from "./types";
