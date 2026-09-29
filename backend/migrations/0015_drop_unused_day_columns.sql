-- days.steps and days.carb_scale were never read. The carb scale is derived from the
-- profile whenever a plan is made (Targets.carb_scale) and applied to the portions then;
-- steps had no reader at all and, since PATCH /days stopped accepting it, no writer.
-- depends: 0014_drop_day_location

ALTER TABLE days DROP COLUMN steps;
ALTER TABLE days DROP COLUMN carb_scale;
