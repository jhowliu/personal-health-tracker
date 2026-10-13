# Recap

## Current task

- Implemented a bilingual, account-level spotlight onboarding tour on
  `codex/onboarding-spotlight`, stacked on the English i18n branch (`codex/english-i18n`, PR #30).
- Opened stacked PR #31: https://github.com/jhowliu/personal-health-tracker/pull/31
- The tour follows the agreed path: body check-in → breakfast → food library → search → first food
  → portion → add → photo-recognition introduction → return to breakfast.

## What changed

- Added versioned onboarding persistence (`users.onboarding_version_seen`) with migration 0025 and
  authenticated GET/PUT `/users/me/onboarding` endpoints. Existing accounts are migrated to version
  1; accounts created afterward start at version 0. Updates are monotonic.
- Added a reusable onboarding provider, spotlight target component, scrim/tooltip overlay, progress,
  Back/Exit controls, welcome and completion modals, accessibility announcements, and Chinese/English
  copy. Disabled target actions remain disabled through the tour.
- Connected the tour to Today body fields/save, automatic breakfast progression, Add food, the native
  add-food sheet, food search/result/portion/add, non-invoking photo recognition education, and Done.
- Added Settings → 新手導覽 / Getting started for replay. A replay after today's body log exists uses
  a shorter review step instead of requesting duplicate entry.
- Regenerated OpenAPI and mobile API types. Added unit tests for step sequences and backend versioning.

## Validation completed

- Mobile: `npm run typecheck`, `npm run lint`, `npm test -- --runInBand` — 10 suites / 82 tests.
- Backend: `.venv/bin/ruff check .`, `.venv/bin/python -m pytest -q` — 246 passed.
- Architecture/OpenAPI: `.venv/bin/lint-imports` (4 contracts kept) and
  `.venv/bin/python -m scripts.check_openapi` passed.
- `git diff --check` passed.
- Live Chinese browser QA at `http://localhost:8081` completed the entire 11-step path. Verified the
  body save automatically opens breakfast, the native sheet spotlight renders above the modal, photo
  education does not open the camera, Done returns to breakfast, completion displays, and replay with
  an existing body log uses the 9-step review path.
- Local backend is running on port 8010 and Expo web on port 8081. Migration 0025 was applied to
  `backend/dev.sqlite`.
- The temporary registration-only QA account was deleted after testing. The existing browser QA
  account retains today's 62 kg body log and a breakfast entry of two pieces of toast.

## Decisions and remaining gaps

- Photo recognition is introduced only; the tour never opens camera/gallery or requests permission.
- Existing accounts are not interrupted automatically, but can replay from Settings. New accounts see
  the offer once their profile is ready.
- The tour can be deferred without marking it complete; Skip/Exit and full completion persist version 1.
- Physical iOS/Android checks for native modal layering, largest Dynamic Type, screen-reader focus,
  reduced motion, and landscape are still recommended before release.

## Next target

- Review PR #31 after PR #30 is ready. Test the English replay and complete the physical-device
  accessibility pass before merging.
