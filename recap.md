# Recap

## Current task

- English (`en`) i18n is implemented across the mobile app, including auth, Today, Progress,
  Meals, Workouts, Focus mode, Settings, privacy, validation, accessibility, alerts, and local
  notifications.
- Pull request [#30](https://github.com/jhowliu/personal-health-tracker/pull/30) is open from
  `codex/english-i18n` into `main`.

## What changed

- Added typed `zh-TW` and `en` catalogs with compile-time key/variable parity checks, runtime locale
  detection, System/繁體中文/English preference persistence, and locale-aware number/date formatting.
- Added native locale metadata and permission strings. Web now updates `<html lang>` and the page
  title (`Daily Fat Loss Plan`) when English is active.
- Requests send `Accept-Language`; registration sends the current locale; legacy Chinese API errors
  are translated for English UI.
- Migrated every user-facing hard-coded Chinese mobile string found by the source scan to the
  catalog. Internal comments, tests, and bilingual custom-exercise matching patterns remain by
  design.
- Workout weekdays use compact `Mon`–`Sun` labels while accessibility labels keep full weekday
  names. Exercise-library category/body/equipment filters are English, including `All equipment`.
- Built-in exercise, food, and public workout-plan names/descriptions localize by request locale.
  Added migration `0024_builtin_catalog_translations.sql` plus seed translation data and tests.
- Added English-name matching for custom-exercise figure animations.

## Validation completed

- Fixed PR #30 backend CI failure caused by Ruff `E501` in `backend/app/api/deps.py`; the exact
  CI lint command (`.venv/bin/ruff check .`) now passes locally.
- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` — 9 suites / 79 tests.
- Backend: `.venv/bin/python -m pytest -q` — 245 passed.
- OpenAPI: `.venv/bin/python -m scripts.check_openapi` — current.
- Web production export completed successfully.
- `git diff --check` passed.
- Live browser QA at `http://localhost:8081` verified:
  - `All equipment`, all equipment filters, and 64 English built-in exercises.
  - `Mon`–`Sun` weekly schedule and 12 English public workout plans.
  - English Meals home, New meal editor, and add-food/photo options.
  - English web page title and no console errors (only expected Expo/Reanimated warnings).
- Local backend and Expo development servers are running.

## Decisions and remaining gaps

- User-authored names stay exactly as entered; only built-in catalog content is translated.
- Existing stored AI weekly advice may remain Chinese. Fully localizing generated AI advice needs
  locale-aware prompting plus either per-locale storage or regeneration semantics.
- Native metadata changes require a new development/EAS binary; they are not OTA-only changes.
- A physical-device pass at large Dynamic Type and native notification permission flows is still
  recommended before release.

## Next target

- Review and merge PR #30, then add locale-aware AI weekly-advice generation/storage and run
  physical iOS/Android QA.
