-- Daily fat-loss plan: initial schema (23 tables)
-- depends:

-- ========= shared =========
CREATE TABLE translations (
  key    TEXT NOT NULL,
  locale TEXT NOT NULL,
  text   TEXT NOT NULL,
  PRIMARY KEY (key, locale)
) WITHOUT ROWID;

-- ========= accounts and tracking =========
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  locale        TEXT NOT NULL DEFAULT 'zh-TW',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE user_identities (
  provider         TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_subject TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, provider_subject)
) WITHOUT ROWID;

CREATE INDEX idx_user_identities_user ON user_identities(user_id);

CREATE TABLE profiles (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex               TEXT NOT NULL CHECK (sex IN ('f', 'm')),
  birth_date        TEXT NOT NULL,
  height_cm         REAL NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg         REAL NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  activity_level    TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active')),
  deficit_pct       INTEGER NOT NULL CHECK (deficit_pct IN (10, 12, 15, 20)),
  carb_base_g       REAL NOT NULL,
  auto_scale_carbs  INTEGER NOT NULL DEFAULT 1 CHECK (auto_scale_carbs IN (0, 1)),
  auto_assign_meals INTEGER NOT NULL DEFAULT 1 CHECK (auto_assign_meals IN (0, 1)),
  workout_time      TEXT NOT NULL DEFAULT 'pm' CHECK (workout_time IN ('am', 'pm')),
  default_location  TEXT NOT NULL DEFAULT 'home' CHECK (default_location IN ('home', 'gym')),
  reminder_time     TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Australia/Brisbane',
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE devices (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token   TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_devices_user ON devices(user_id);

CREATE TABLE body_logs (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  weight_kg  REAL CHECK (weight_kg BETWEEN 30 AND 300),
  waist_cm   REAL CHECK (waist_cm BETWEEN 40 AND 200),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, date),
  CHECK (weight_kg IS NOT NULL OR waist_cm IS NOT NULL)
) WITHOUT ROWID;

CREATE TABLE meal_photos (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'analyzing', 'done', 'failed')),
  result_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  analyzed_at TEXT
);

CREATE INDEX idx_meal_photos_user ON meal_photos(user_id, created_at);

-- ========= foods and meals =========
CREATE TABLE food_categories (
  id         TEXT PRIMARY KEY,
  name_key   TEXT NOT NULL,
  swap_by    TEXT NOT NULL CHECK (swap_by IN ('carb', 'protein', 'kcal', 'none')),
  sort_order INTEGER NOT NULL
);

CREATE TABLE foods (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  category_id     TEXT NOT NULL REFERENCES food_categories(id),
  name_key        TEXT,
  name            TEXT,
  state           TEXT NOT NULL DEFAULT 'na' CHECK (state IN ('raw', 'cooked', 'na')),
  kcal_per_100g   REAL NOT NULL CHECK (kcal_per_100g >= 0),
  protein_per_100g REAL NOT NULL CHECK (protein_per_100g >= 0),
  fat_per_100g    REAL NOT NULL CHECK (fat_per_100g >= 0),
  carb_per_100g   REAL NOT NULL CHECK (carb_per_100g >= 0),
  fiber_per_100g  REAL CHECK (fiber_per_100g >= 0),
  unit            TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml', 'piece', 'scoop', 'bowl')),
  grams_per_unit  REAL CHECK (grams_per_unit > 0),
  usual_grams     REAL NOT NULL CHECK (usual_grams > 0),
  max_grams       REAL NOT NULL,
  source          TEXT CHECK (source IN ('AFCD', 'TFDA', 'label', 'user')),
  source_id       TEXT,
  archived_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((name_key IS NULL) <> (name IS NULL)),
  CHECK (max_grams >= usual_grams),
  CHECK (unit = 'g' OR grams_per_unit IS NOT NULL)
);

CREATE INDEX idx_foods_category ON foods(category_id) WHERE archived_at IS NULL;
CREATE INDEX idx_foods_user ON foods(user_id);

CREATE TABLE food_aliases (
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias   TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (food_id, alias)
) WITHOUT ROWID;

CREATE INDEX idx_food_aliases_alias ON food_aliases(alias);

CREATE TABLE meals (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT 'regular' CHECK (tag IN ('regular', 'light', 'occasional')),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_meals_user ON meals(user_id) WHERE archived_at IS NULL;

CREATE TABLE meal_times (
  meal_id   TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  meal_time TEXT NOT NULL CHECK (meal_time IN ('breakfast', 'lunch', 'dinner')),
  PRIMARY KEY (meal_id, meal_time)
) WITHOUT ROWID;

CREATE TABLE meal_items (
  id         TEXT PRIMARY KEY,
  meal_id    TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id    TEXT NOT NULL REFERENCES foods(id),
  grams      REAL NOT NULL CHECK (grams > 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_meal_items_meal ON meal_items(meal_id, sort_order);

-- ========= training =========
CREATE TABLE exercise_categories (
  id         TEXT PRIMARY KEY,
  name_key   TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE exercises (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  category_id     TEXT NOT NULL REFERENCES exercise_categories(id),
  name_key        TEXT,
  name            TEXT,
  description_key TEXT,
  description     TEXT,
  archived_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((name_key IS NULL) <> (name IS NULL))
);

CREATE TABLE workout_templates (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES exercise_categories(id),
  name         TEXT NOT NULL,
  location     TEXT NOT NULL CHECK (location IN ('home', 'gym', 'both')),
  duration_min INTEGER CHECK (duration_min BETWEEN 0 AND 240),
  archived_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_workout_templates_user ON workout_templates(user_id) WHERE archived_at IS NULL;

CREATE TABLE workout_template_items (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  sort_order  INTEGER NOT NULL,
  sets        INTEGER CHECK (sets BETWEEN 1 AND 10),
  reps        TEXT NOT NULL,
  weight_kg   REAL CHECK (weight_kg >= 0),
  rest_sec    INTEGER NOT NULL DEFAULT 60,
  note        TEXT
);

CREATE INDEX idx_template_items ON workout_template_items(template_id, sort_order);

CREATE TABLE workout_schedule (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday     INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  location    TEXT NOT NULL CHECK (location IN ('home', 'gym')),
  template_id TEXT NOT NULL REFERENCES workout_templates(id),
  PRIMARY KEY (user_id, weekday, location)
) WITHOUT ROWID;

-- ========= daily records =========
CREATE TABLE days (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  workout_time    TEXT NOT NULL CHECK (workout_time IN ('am', 'pm')),
  location        TEXT NOT NULL CHECK (location IN ('home', 'gym')),
  template_id     TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  carb_scale      REAL NOT NULL DEFAULT 1.0,
  steps           INTEGER CHECK (steps >= 0),
  workout_done_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, date)
) WITHOUT ROWID;

CREATE TABLE day_meals (
  user_id   TEXT NOT NULL,
  date      TEXT NOT NULL,
  meal_time TEXT NOT NULL CHECK (meal_time IN ('breakfast', 'lunch', 'dinner', 'extras')),
  meal_id   TEXT REFERENCES meals(id),
  eaten_at  TEXT,
  PRIMARY KEY (user_id, date, meal_time),
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE,
  CHECK (meal_time <> 'extras' OR meal_id IS NULL)
) WITHOUT ROWID;

CREATE TABLE day_meal_items (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  meal_time   TEXT NOT NULL,
  food_id     TEXT REFERENCES foods(id),
  custom_name TEXT,
  grams       REAL CHECK (grams > 0),
  kcal        REAL CHECK (kcal >= 0),
  protein_g   REAL CHECK (protein_g >= 0),
  fat_g       REAL CHECK (fat_g >= 0),
  carb_g      REAL CHECK (carb_g >= 0),
  photo_id    TEXT REFERENCES meal_photos(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id, date, meal_time)
    REFERENCES day_meals(user_id, date, meal_time) ON DELETE CASCADE,
  CHECK ((food_id IS NOT NULL AND grams IS NOT NULL)
      OR (food_id IS NULL AND custom_name IS NOT NULL AND kcal IS NOT NULL))
);

CREATE INDEX idx_day_meal_items_slot ON day_meal_items(user_id, date, meal_time);

CREATE TABLE set_logs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  date             TEXT NOT NULL,
  template_item_id TEXT REFERENCES workout_template_items(id) ON DELETE SET NULL,
  exercise_id      TEXT NOT NULL REFERENCES exercises(id),
  set_index        INTEGER NOT NULL CHECK (set_index >= 0),
  reps_done        INTEGER CHECK (reps_done >= 0),
  weight_kg        REAL CHECK (weight_kg >= 0),
  done_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, date, template_item_id, set_index),
  FOREIGN KEY (user_id, date) REFERENCES days(user_id, date) ON DELETE CASCADE
);

CREATE INDEX idx_set_logs_history ON set_logs(user_id, exercise_id, date);
