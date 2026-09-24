-- Bound daily image-recognition attempts by the timestamp at which analysis starts.
-- depends: 0003_exercise_catalog_metadata
CREATE INDEX idx_meal_photos_analysis_quota ON meal_photos(user_id, analyzed_at);
