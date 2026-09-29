ALTER TABLE days ADD COLUMN location TEXT NOT NULL DEFAULT 'home'
  CHECK (location IN ('home', 'gym'));

UPDATE days SET location = COALESCE(
  (SELECT p.default_location FROM profiles p WHERE p.user_id = days.user_id), 'home'
);
