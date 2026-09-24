-- The per-day prescriptions cannot be put back into templates they were copied from.
CREATE TABLE daily_workout_overrides (
  user_id                 TEXT NOT NULL,
  date                    TEXT NOT NULL,
  template_item_id        TEXT NOT NULL REFERENCES workout_template_items(id) ON DELETE CASCADE,
  replacement_exercise_id TEXT NOT NULL REFERENCES exercises(id),
  reason                  TEXT NOT NULL CHECK (reason IN (
    'equipment_occupied', 'knee_discomfort', 'missing_equipment', 'variety'
  )),
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, date, template_item_id),
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE
) WITHOUT ROWID;

CREATE TABLE set_logs_rebuilt (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  date             TEXT NOT NULL,
  template_item_id TEXT REFERENCES workout_template_items(id) ON DELETE SET NULL,
  exercise_id      TEXT NOT NULL REFERENCES exercises(id),
  set_index        INTEGER NOT NULL CHECK (set_index >= 0),
  reps_done        INTEGER CHECK (reps_done >= 0),
  duration_sec     INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
  weight_kg        REAL CHECK (weight_kg >= 0),
  effort           TEXT CHECK (effort IS NULL OR effort IN ('easy', 'appropriate', 'hard')),
  done_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, date, template_item_id, set_index),
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE
);

INSERT INTO set_logs_rebuilt (
  id, user_id, date, template_item_id, exercise_id, set_index,
  reps_done, duration_sec, weight_kg, effort, done_at
)
SELECT id, user_id, date, (SELECT source_item_id FROM day_workout_items d
                           WHERE d.id = set_logs.day_workout_item_id),
       exercise_id, set_index, reps_done, duration_sec, weight_kg, effort, done_at
FROM set_logs;

DROP TABLE set_logs;
ALTER TABLE set_logs_rebuilt RENAME TO set_logs;
CREATE INDEX idx_set_logs_history ON set_logs(user_id, exercise_id, date);

DROP INDEX IF EXISTS idx_day_workout_items;
DROP TABLE day_workout_items;
