-- Time as a first-class prescription, not a string in the reps field.
--
-- The spec asks for "組數、次數或時間"; the schema only had reps, so cardio was written as
-- the literal text "20 分鐘" and the minutes actually spent were never recorded at all.
-- An item now carries reps or duration_sec (at least one), and a logged set can say how
-- long it really took.
--
-- exercises.location also gains 'outdoor', for a tennis court or a pool — neither home
-- nor gym. The column is one migration old and every value in it comes from the seed, so
-- dropping and re-adding it costs nothing a re-seed does not put back.
-- depends: 0008_exercise_location

ALTER TABLE exercises DROP COLUMN location;
ALTER TABLE exercises ADD COLUMN location TEXT CHECK (
  location IS NULL OR location IN ('home', 'gym', 'outdoor', 'both')
);

ALTER TABLE set_logs ADD COLUMN duration_sec INTEGER CHECK (
  duration_sec IS NULL OR duration_sec > 0
);

CREATE TABLE workout_template_items_rebuilt (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL REFERENCES exercises(id),
  sort_order   INTEGER NOT NULL,
  sets         INTEGER CHECK (sets BETWEEN 1 AND 10),
  reps         TEXT,
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
  weight_kg    REAL CHECK (weight_kg >= 0),
  rest_sec     INTEGER NOT NULL DEFAULT 60,
  note         TEXT,
  CHECK (reps IS NOT NULL OR duration_sec IS NOT NULL)
);

INSERT INTO workout_template_items_rebuilt (
  id, template_id, exercise_id, sort_order, sets, reps, duration_sec, weight_kg, rest_sec, note
)
SELECT id, template_id, exercise_id, sort_order, sets, reps, NULL, weight_kg, rest_sec, note
FROM workout_template_items;

DROP TABLE workout_template_items;
ALTER TABLE workout_template_items_rebuilt RENAME TO workout_template_items;

CREATE INDEX idx_template_items ON workout_template_items(template_id, sort_order);
