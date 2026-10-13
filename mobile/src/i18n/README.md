# Translation catalog

`locales/zh-TW.ts` is the canonical key schema. `locales/en.ts` must satisfy that exact recursive
shape, so TypeScript rejects missing, misspelled, and extra keys.

## Rules

- Keys describe meaning and context, not the source sentence.
- Reuse `common` keys only when the meaning and grammar are genuinely shared.
- Keep complete sentences together. Do not translate JSX fragments that English may need to reorder.
- Runtime interpolation uses i18n-js placeholders such as `%{name}`.
- Count-dependent copy uses `one` and `other`, even when Traditional Chinese renders both the same.
- User-created names and notes are content, not translation keys.
- Built-in food, exercise, and workout-template names are server catalog translations, not mobile keys.
- Native app names and permission prompts live in Expo locale files and are tracked separately.

The first migration pass should replace source strings with these keys without inventing new copy.
If a new key is truly required, add it to both catalogs and keep placeholder names identical.

## Runtime

- `I18nProvider` resolves `System`, `zh-TW`, or `en` and persists the preference in AsyncStorage.
- React components call `useI18n().t`; non-React modules import `translate` from `translator.ts`.
- `getActiveLocale()` supplies the `Accept-Language` request header. Do not import the React provider
  from API, notification, or other framework-independent modules.
- App locale `en` formats numbers and dates with `en-AU`; API and catalog identifiers remain `en`.
- Unsupported system languages fall back to `zh-TW`.
