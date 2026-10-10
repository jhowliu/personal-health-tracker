-- One row per week the user has a report for: when it was first shown, so it pops up only
-- once, and the AI review written for it, so the model is asked once per week.
-- depends: 0021_set_speed_incline

CREATE TABLE weekly_reports (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,  -- the Monday
  seen_at    TEXT,
  advice     TEXT,           -- JSON: {"diet", "training", "body"}
  advice_at  TEXT,
  PRIMARY KEY (user_id, week_start)
) WITHOUT ROWID;
