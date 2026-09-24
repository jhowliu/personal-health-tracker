-- The day's workout becomes a snapshot, the way the day's meals already are.
--
-- Until now a day pointed at a template and the template's items were read live, so
-- editing a template rewrote history — and worse, saving one at all wiped that day's
-- records: replace_items deletes every row and re-inserts, which with foreign keys on
-- nulls set_logs.template_item_id and cascades the overrides away. A per-day copy makes
-- the prescription a fact of that date, exactly like day_meal_items.
--
-- daily_workout_overrides goes with it: swapping an exercise is now an update on the
-- day's own row, mirroring replace_plan_item on the meal side.
--
-- Existing set_logs keep their reps, weight, effort and date — only the link to a
-- template item is dropped, since those items were never a stable target. History by
-- (user_id, exercise_id, date) is unaffected.
-- depends: 0009_timed_exercises

CREATE TABLE day_workout_items (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL,
  date                 TEXT NOT NULL,
  exercise_id          TEXT NOT NULL REFERENCES exercises(id),
  sort_order           INTEGER NOT NULL,
  sets                 INTEGER CHECK (sets BETWEEN 1 AND 10),
  reps                 TEXT,
  duration_sec         INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
  weight_kg            REAL CHECK (weight_kg >= 0),
  rest_sec             INTEGER NOT NULL DEFAULT 60,
  note                 TEXT,
  -- Set together when the day's exercise was swapped, so the screen can still say what
  -- it replaced and why.
  replaced_exercise_id TEXT REFERENCES exercises(id),
  replacement_reason   TEXT CHECK (replacement_reason IS NULL OR replacement_reason IN (
    'equipment_occupied', 'knee_discomfort', 'missing_equipment', 'variety'
  )),
  -- Which template item this was copied from, so "套用到課表" knows where to write back.
  -- Deliberately not a foreign key: the template may be edited out from under it.
  source_item_id       TEXT,
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE,
  CHECK (reps IS NOT NULL OR duration_sec IS NOT NULL),
  CHECK ((replaced_exercise_id IS NULL) = (replacement_reason IS NULL))
);

CREATE INDEX idx_day_workout_items ON day_workout_items(user_id, date, sort_order);

CREATE TABLE set_logs_rebuilt (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  date                TEXT NOT NULL,
  day_workout_item_id TEXT REFERENCES day_workout_items(id) ON DELETE SET NULL,
  exercise_id         TEXT NOT NULL REFERENCES exercises(id),
  set_index           INTEGER NOT NULL CHECK (set_index >= 0),
  reps_done           INTEGER CHECK (reps_done >= 0),
  duration_sec        INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
  weight_kg           REAL CHECK (weight_kg >= 0),
  effort              TEXT CHECK (effort IS NULL OR effort IN ('easy', 'appropriate', 'hard')),
  done_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, date, day_workout_item_id, set_index),
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE
);

INSERT INTO set_logs_rebuilt (
  id, user_id, date, day_workout_item_id, exercise_id, set_index,
  reps_done, duration_sec, weight_kg, effort, done_at
)
SELECT id, user_id, date, NULL, exercise_id, set_index,
       reps_done, duration_sec, weight_kg, effort, done_at
FROM set_logs;

DROP TABLE set_logs;
ALTER TABLE set_logs_rebuilt RENAME TO set_logs;

CREATE INDEX idx_set_logs_history ON set_logs(user_id, exercise_id, date);

DROP TABLE daily_workout_overrides;
