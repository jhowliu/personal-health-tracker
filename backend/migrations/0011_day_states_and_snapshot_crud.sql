-- Day completion is a user choice, not an inference from a missing record.
-- Mutual exclusion is maintained by the application's write paths: SQLite cannot express
-- this across existing columns without rebuilding these tables.
-- depends: 0010_day_workout_snapshot

ALTER TABLE day_meals ADD COLUMN skipped_at TEXT;
ALTER TABLE days ADD COLUMN workout_skipped_at TEXT;

CREATE INDEX idx_day_meals_completion
  ON day_meals(user_id, date, meal_time, eaten_at, skipped_at);
