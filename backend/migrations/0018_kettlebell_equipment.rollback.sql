-- Kettlebell exercises lose their equipment; the rest keep theirs.
DROP INDEX idx_exercises_active_catalog;
ALTER TABLE exercises RENAME COLUMN equipment TO equipment_with_kettlebell;
ALTER TABLE exercises ADD COLUMN equipment TEXT CHECK (
  equipment IS NULL OR equipment IN (
    'bodyweight', 'machine', 'barbell', 'dumbbell', 'cable', 'resistance_band', 'treadmill'
  )
);
UPDATE exercises SET equipment = NULLIF(equipment_with_kettlebell, 'kettlebell');
ALTER TABLE exercises DROP COLUMN equipment_with_kettlebell;
CREATE INDEX idx_exercises_active_catalog
  ON exercises(category_id, body_region, equipment, user_id)
  WHERE archived_at IS NULL;
