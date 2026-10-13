-- Remember the newest first-run tour completed by each account.
-- Existing accounts have already learned the current app, so only accounts created after this
-- migration should be offered version 1 automatically.
-- depends: 0024_builtin_catalog_translations

ALTER TABLE users
ADD COLUMN onboarding_version_seen INTEGER NOT NULL DEFAULT 0
CHECK (onboarding_version_seen >= 0);

UPDATE users SET onboarding_version_seen = 1;
