-- A treadmill set's speed and incline, when the user gives them. With them the burn comes
-- from the ACSM walking or running equation rather than the exercise's flat MET.
-- depends: 0020_workout_trained_sec

ALTER TABLE set_logs ADD COLUMN speed_kmh REAL
  CHECK (speed_kmh IS NULL OR (speed_kmh > 0 AND speed_kmh <= 30));
ALTER TABLE set_logs ADD COLUMN incline_pct REAL
  CHECK (incline_pct IS NULL OR (incline_pct >= 0 AND incline_pct <= 40));
