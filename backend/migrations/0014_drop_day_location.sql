-- days.location was written when a day opened and never read: the location a workout is
-- done at comes from its template and exercises, not from the day.
-- depends: 0013_private_food_catalog

ALTER TABLE days DROP COLUMN location;
