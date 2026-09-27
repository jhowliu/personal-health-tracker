-- Workout templates can be global built-ins. A null owner makes the row visible to every
-- account while keeping user-owned templates tied to account deletion.
-- depends: 0011_day_states_and_snapshot_crud

CREATE TABLE workout_templates_rebuilt (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES exercise_categories(id),
  name         TEXT NOT NULL,
  location     TEXT NOT NULL CHECK (location IN ('home', 'gym', 'both')),
  duration_min INTEGER CHECK (duration_min BETWEEN 0 AND 240),
  archived_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO workout_templates_rebuilt (
  id, user_id, category_id, name, location, duration_min, archived_at, created_at, updated_at
)
SELECT id, user_id, category_id, name, location, duration_min, archived_at, created_at, updated_at
FROM workout_templates;

DROP TABLE workout_templates;
ALTER TABLE workout_templates_rebuilt RENAME TO workout_templates;

CREATE INDEX idx_workout_templates_user
  ON workout_templates(user_id) WHERE archived_at IS NULL;
