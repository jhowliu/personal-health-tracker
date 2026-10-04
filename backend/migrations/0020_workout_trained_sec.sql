-- Seconds focus mode clocked on the day, summed over sessions (a workout resumed after
-- finishing adds its own). Counted exercises have no time of their own, so the burn
-- estimate shares this out over them.
-- depends: 0019_exercise_priced_daily

ALTER TABLE days ADD COLUMN workout_trained_sec INTEGER
  CHECK (workout_trained_sec IS NULL OR workout_trained_sec >= 0);
