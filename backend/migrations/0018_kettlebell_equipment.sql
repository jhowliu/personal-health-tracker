-- Kettlebells join the equipment an exercise can name, for the no-barbell workout templates.
-- SQLite cannot change a CHECK in place, so the column is rebuilt: set aside, re-added with
-- the longer list, copied back, and the old column dropped along with its CHECK.
-- depends: 0017_drop_meal_tag

DROP INDEX idx_exercises_active_catalog;
ALTER TABLE exercises RENAME COLUMN equipment TO equipment_before_kettlebell;
ALTER TABLE exercises ADD COLUMN equipment TEXT CHECK (
  equipment IS NULL OR equipment IN (
    'bodyweight', 'machine', 'barbell', 'dumbbell', 'kettlebell', 'cable', 'resistance_band',
    'treadmill'
  )
);
UPDATE exercises SET equipment = equipment_before_kettlebell;
ALTER TABLE exercises DROP COLUMN equipment_before_kettlebell;
CREATE INDEX idx_exercises_active_catalog
  ON exercises(category_id, body_region, equipment, user_id)
  WHERE archived_at IS NULL;
