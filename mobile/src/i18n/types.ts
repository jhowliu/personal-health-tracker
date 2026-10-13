export const SUPPORTED_LOCALES = ["zh-TW", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = SupportedLocale | "system";

export type TranslationShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string
    ? string
    : TranslationShape<T[Key]>;
};

type LeafPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${LeafPaths<T[Key]>}`
      : never;
}[keyof T & string];

export type TranslationKey<T> = LeafPaths<T>;
