DROP INDEX IF EXISTS idx_exercises_active_catalog;
ALTER TABLE exercises DROP COLUMN equipment;
ALTER TABLE exercises DROP COLUMN body_region;
