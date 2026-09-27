-- One weekly schedule, not one per location.
--
-- Location was part of the schedule's key, so a user kept two parallel weeks and the day
-- picked between them by days.location. That value comes from profiles.default_location,
-- which the app never lets anyone change, so the second week was unreachable while still
-- costing a dimension everywhere. It survives as a label on the template instead.
-- depends: 0006_exercise_met

CREATE TABLE workout_schedule_rebuilt (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  template_id TEXT NOT NULL REFERENCES workout_templates(id),
  PRIMARY KEY (user_id, weekday)
) WITHOUT ROWID;

-- A user who somehow had both locations on one weekday keeps whichever template sorts
-- first, so the collapse is deterministic rather than whatever the scan happened to hit.
INSERT INTO workout_schedule_rebuilt (user_id, weekday, template_id)
SELECT user_id, weekday, MIN(template_id) FROM workout_schedule GROUP BY user_id, weekday;

DROP TABLE workout_schedule;
ALTER TABLE workout_schedule_rebuilt RENAME TO workout_schedule;
