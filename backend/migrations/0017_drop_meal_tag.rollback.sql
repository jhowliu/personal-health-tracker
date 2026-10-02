ALTER TABLE meals ADD COLUMN tag TEXT NOT NULL DEFAULT 'regular' CHECK (tag IN ('regular', 'light', 'occasional'));
