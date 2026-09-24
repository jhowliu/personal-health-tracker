DROP INDEX IF EXISTS idx_day_meals_completion;
ALTER TABLE day_meals DROP COLUMN skipped_at;
ALTER TABLE days DROP COLUMN workout_skipped_at;
