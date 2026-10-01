-- Meals are no longer dealt into the day automatically: people log what they actually ate
-- (a photo, a saved meal, or foods) after cooking, so the per-profile switch has no reader.
-- depends: 0015_drop_unused_day_columns

ALTER TABLE profiles DROP COLUMN auto_assign_meals;
