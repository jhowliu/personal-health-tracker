-- MET (metabolic equivalent) per built-in exercise. Custom exercises leave it unset.
--
-- This value only ever feeds a displayed "about N kcal" estimate. It must not reach
-- compute_targets(): the profile's activity factor already prices the user's training into
-- TDEE, so spending it again on the day's calorie target would count one workout twice.
-- depends: 0005_workout_execution

ALTER TABLE exercises ADD COLUMN met REAL CHECK (met IS NULL OR met > 0);
