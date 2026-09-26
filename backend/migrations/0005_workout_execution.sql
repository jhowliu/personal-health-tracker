-- Daily exercise substitutions are facts for one scheduled workout, never template edits.
-- depends: 0004_p3_meal_photo_analysis

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

ALTER TABLE set_logs ADD COLUMN effort TEXT CHECK (
  effort IS NULL OR effort IN ('easy', 'appropriate', 'hard')
);
