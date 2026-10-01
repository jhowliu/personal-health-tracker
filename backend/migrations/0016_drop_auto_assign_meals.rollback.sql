ALTER TABLE profiles ADD COLUMN auto_assign_meals INTEGER NOT NULL DEFAULT 1 CHECK (auto_assign_meals IN (0, 1));
