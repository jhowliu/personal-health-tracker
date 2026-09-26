-- Restoring the column cannot restore the second week: it was collapsed on the way up.
CREATE TABLE workout_schedule_rebuilt (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  location    TEXT NOT NULL CHECK (location IN ('home', 'gym')),
  template_id TEXT NOT NULL REFERENCES workout_templates(id),
  PRIMARY KEY (user_id, weekday, location)
) WITHOUT ROWID;

INSERT INTO workout_schedule_rebuilt (user_id, weekday, location, template_id)
SELECT ws.user_id, ws.weekday,
       CASE WHEN t.location = 'gym' THEN 'gym' ELSE 'home' END,
       ws.template_id
FROM workout_schedule ws
JOIN workout_templates t ON t.id = ws.template_id;

DROP TABLE workout_schedule;
ALTER TABLE workout_schedule_rebuilt RENAME TO workout_schedule;
