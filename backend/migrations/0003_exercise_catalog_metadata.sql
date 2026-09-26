-- Exercise catalog metadata. Existing custom exercises may leave both values unset.
-- depends: 0002_seed_categories

ALTER TABLE exercises ADD COLUMN body_region TEXT CHECK (
  body_region IS NULL OR body_region IN (
    'lower_body', 'upper_body', 'core', 'full_body', 'mobility'
  )
);

ALTER TABLE exercises ADD COLUMN equipment TEXT CHECK (
  equipment IS NULL OR equipment IN (
    'bodyweight', 'machine', 'barbell', 'dumbbell', 'cable', 'resistance_band', 'treadmill'
  )
);

CREATE INDEX idx_exercises_active_catalog
  ON exercises(category_id, body_region, equipment, user_id)
  WHERE archived_at IS NULL;
