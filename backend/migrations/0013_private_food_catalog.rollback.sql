ALTER TABLE days DROP COLUMN workout_initialized_at;
ALTER TABLE day_meal_items DROP COLUMN nutrition_snapshot_grams;

CREATE TABLE foods_shared (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  category_id      TEXT NOT NULL REFERENCES food_categories(id),
  name_key         TEXT,
  name             TEXT,
  state            TEXT NOT NULL DEFAULT 'na' CHECK (state IN ('raw', 'cooked', 'na')),
  kcal_per_100g    REAL NOT NULL CHECK (kcal_per_100g >= 0),
  protein_per_100g REAL NOT NULL CHECK (protein_per_100g >= 0),
  fat_per_100g     REAL NOT NULL CHECK (fat_per_100g >= 0),
  carb_per_100g    REAL NOT NULL CHECK (carb_per_100g >= 0),
  fiber_per_100g   REAL CHECK (fiber_per_100g >= 0),
  unit             TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g', 'ml', 'piece', 'scoop', 'bowl')),
  grams_per_unit   REAL CHECK (grams_per_unit > 0),
  usual_grams      REAL NOT NULL CHECK (usual_grams > 0),
  max_grams        REAL NOT NULL,
  source           TEXT CHECK (source IN ('AFCD', 'TFDA', 'label', 'user')),
  source_id        TEXT,
  archived_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((name_key IS NULL) <> (name IS NULL)),
  CHECK (max_grams >= usual_grams),
  CHECK (unit = 'g' OR grams_per_unit IS NOT NULL)
);

INSERT INTO foods_shared (
  id, user_id, category_id, name, state, kcal_per_100g, protein_per_100g,
  fat_per_100g, carb_per_100g, fiber_per_100g, unit, grams_per_unit,
  usual_grams, max_grams, source, archived_at, created_at, updated_at
)
SELECT id, user_id, category_id, name, state, kcal_per_100g, protein_per_100g,
       fat_per_100g, carb_per_100g, fiber_per_100g, unit, grams_per_unit,
       usual_grams, max_grams, 'user', archived_at, created_at, updated_at
FROM foods;

INSERT INTO foods_shared (
  id, category_id, name, state, kcal_per_100g, protein_per_100g,
  fat_per_100g, carb_per_100g, fiber_per_100g, unit, grams_per_unit,
  usual_grams, max_grams, source, archived_at, created_at, updated_at
)
SELECT id, category_id, name, state, kcal_per_100g, protein_per_100g,
       fat_per_100g, carb_per_100g, fiber_per_100g, unit, grams_per_unit,
       usual_grams, max_grams, 'user', retired_at, created_at, updated_at
FROM food_templates;

CREATE TABLE food_aliases_shared (
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias   TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (food_id, alias)
) WITHOUT ROWID;

INSERT INTO food_aliases_shared (food_id, alias)
SELECT food_id, alias FROM food_aliases;

INSERT OR IGNORE INTO food_aliases_shared (food_id, alias)
SELECT t.id, a.value FROM food_templates t, json_each(t.aliases_json) a;

DROP TABLE food_aliases;
DROP TABLE foods;
ALTER TABLE foods_shared RENAME TO foods;
ALTER TABLE food_aliases_shared RENAME TO food_aliases;
DROP TABLE food_templates;

CREATE INDEX idx_foods_category ON foods(category_id) WHERE archived_at IS NULL;
CREATE INDEX idx_foods_user ON foods(user_id);
CREATE INDEX idx_food_aliases_alias ON food_aliases(alias);
