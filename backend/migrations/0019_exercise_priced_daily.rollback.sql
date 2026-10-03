-- The carb baseline comes back as 0 with scaling off, which leaves portions as saved.
-- Earlier activity levels are not restored.
ALTER TABLE profiles ADD COLUMN carb_base_g REAL NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN auto_scale_carbs INTEGER NOT NULL DEFAULT 0 CHECK (auto_scale_carbs IN (0, 1));
