-- Items that only ever had a duration need something in reps to survive the NOT NULL.
CREATE TABLE workout_template_items_rebuilt (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  sort_order  INTEGER NOT NULL,
  sets        INTEGER CHECK (sets BETWEEN 1 AND 10),
  reps        TEXT NOT NULL,
  weight_kg   REAL CHECK (weight_kg >= 0),
  rest_sec    INTEGER NOT NULL DEFAULT 60,
  note        TEXT
);

INSERT INTO workout_template_items_rebuilt (
  id, template_id, exercise_id, sort_order, sets, reps, weight_kg, rest_sec, note
)
SELECT id, template_id, exercise_id, sort_order, sets,
       COALESCE(reps, CAST(duration_sec / 60 AS TEXT) || ' 分鐘'),
       weight_kg, rest_sec, note
FROM workout_template_items;

DROP TABLE workout_template_items;
ALTER TABLE workout_template_items_rebuilt RENAME TO workout_template_items;
CREATE INDEX idx_template_items ON workout_template_items(template_id, sort_order);

ALTER TABLE set_logs DROP COLUMN duration_sec;

ALTER TABLE exercises DROP COLUMN location;
ALTER TABLE exercises ADD COLUMN location TEXT CHECK (
  location IS NULL OR location IN ('home', 'gym', 'both')
);
