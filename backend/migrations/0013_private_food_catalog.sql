-- Default foods are templates; every account owns the food rows used by meals and days.
-- Existing references are remapped before the shared rows are removed. Eaten nutrition is
-- frozen at the current portion so later changes to a personal food do not rewrite history.
-- depends: 0012_builtin_workout_templates

CREATE TABLE food_templates (
  id               TEXT PRIMARY KEY,
  category_id      TEXT NOT NULL REFERENCES food_categories(id),
  name             TEXT NOT NULL CHECK (trim(name) <> ''),
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
  aliases_json     TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(aliases_json)),
  retired_at       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (max_grams >= usual_grams),
  CHECK (unit = 'g' OR grams_per_unit IS NOT NULL)
);

INSERT INTO food_templates (
  id, category_id, name, state, kcal_per_100g, protein_per_100g, fat_per_100g,
  carb_per_100g, fiber_per_100g, unit, grams_per_unit, usual_grams, max_grams, aliases_json,
  retired_at, created_at, updated_at
)
SELECT f.id, f.category_id, COALESCE(f.name, t.text, f.name_key), f.state,
       f.kcal_per_100g, f.protein_per_100g, f.fat_per_100g, f.carb_per_100g,
       f.fiber_per_100g, f.unit, f.grams_per_unit, f.usual_grams, f.max_grams,
       COALESCE((SELECT json_group_array(alias) FROM food_aliases a WHERE a.food_id = f.id), '[]'),
       f.archived_at, f.created_at, f.updated_at
FROM foods f
LEFT JOIN translations t ON t.key = f.name_key AND t.locale = 'zh-TW'
WHERE f.user_id IS NULL;

CREATE TABLE foods_private (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id      TEXT REFERENCES food_templates(id) ON DELETE RESTRICT,
  category_id      TEXT NOT NULL REFERENCES food_categories(id),
  name             TEXT NOT NULL CHECK (trim(name) <> ''),
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
  archived_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (max_grams >= usual_grams),
  CHECK (unit = 'g' OR grams_per_unit IS NOT NULL)
);

INSERT INTO foods_private (
  id, user_id, template_id, category_id, name, state, kcal_per_100g,
  protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g, unit,
  grams_per_unit, usual_grams, max_grams, archived_at, created_at, updated_at
)
SELECT id, user_id, NULL, category_id, name, state, kcal_per_100g,
       protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g, unit,
       grams_per_unit, usual_grams, max_grams, archived_at, created_at, updated_at
FROM foods WHERE user_id IS NOT NULL;

INSERT INTO foods_private (
  id, user_id, template_id, category_id, name, state, kcal_per_100g,
  protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g, unit,
  grams_per_unit, usual_grams, max_grams, archived_at, created_at, updated_at
)
SELECT 'seed:' || u.id || ':' || t.id, u.id, t.id, t.category_id, t.name, t.state,
       t.kcal_per_100g, t.protein_per_100g, t.fat_per_100g, t.carb_per_100g,
       t.fiber_per_100g, t.unit, t.grams_per_unit, t.usual_grams, t.max_grams,
       t.retired_at, t.created_at, t.updated_at
FROM users u CROSS JOIN food_templates t;

CREATE TABLE food_aliases_private (
  food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias   TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (food_id, alias)
) WITHOUT ROWID;

INSERT INTO food_aliases_private (food_id, alias)
SELECT a.food_id, a.alias FROM food_aliases a
JOIN foods f ON f.id = a.food_id WHERE f.user_id IS NOT NULL;

INSERT INTO food_aliases_private (food_id, alias)
SELECT 'seed:' || u.id || ':' || a.food_id, a.alias
FROM users u CROSS JOIN food_aliases a
JOIN foods f ON f.id = a.food_id WHERE f.user_id IS NULL;

UPDATE meal_items SET food_id = (
  SELECT 'seed:' || m.user_id || ':' || meal_items.food_id
  FROM meals m WHERE m.id = meal_items.meal_id
)
WHERE food_id IN (SELECT id FROM foods WHERE user_id IS NULL);

UPDATE day_meal_items SET food_id = 'seed:' || user_id || ':' || food_id
WHERE food_id IN (SELECT id FROM foods WHERE user_id IS NULL);

DROP TABLE food_aliases;
DROP TABLE foods;
ALTER TABLE foods_private RENAME TO foods;
ALTER TABLE food_aliases_private RENAME TO food_aliases;

CREATE UNIQUE INDEX idx_foods_user_template ON foods(user_id, template_id)
  WHERE template_id IS NOT NULL;
CREATE INDEX idx_foods_active_category ON foods(user_id, category_id)
  WHERE archived_at IS NULL;
CREATE INDEX idx_food_aliases_alias ON food_aliases(alias);

ALTER TABLE day_meal_items ADD COLUMN nutrition_snapshot_grams REAL
  CHECK (nutrition_snapshot_grams IS NULL OR nutrition_snapshot_grams > 0);

-- The previous kcal columns on known foods may be stale after a portion edit. Recalculate
-- them from the current food when freezing existing eaten meals and recorded extras.
UPDATE day_meal_items
SET (kcal, protein_g, fat_g, carb_g) = (
      SELECT f.kcal_per_100g * day_meal_items.grams / 100.0,
             f.protein_per_100g * day_meal_items.grams / 100.0,
             f.fat_per_100g * day_meal_items.grams / 100.0,
             f.carb_per_100g * day_meal_items.grams / 100.0
      FROM foods f WHERE f.id = day_meal_items.food_id
    ),
    nutrition_snapshot_grams = grams
WHERE food_id IS NOT NULL AND (
  meal_time = 'extras' OR EXISTS (
    SELECT 1 FROM day_meals dm
    WHERE dm.user_id = day_meal_items.user_id AND dm.date = day_meal_items.date
      AND dm.meal_time = day_meal_items.meal_time AND dm.eaten_at IS NOT NULL
  )
);

ALTER TABLE days ADD COLUMN workout_initialized_at TEXT;
UPDATE days SET workout_initialized_at = created_at
WHERE EXISTS (SELECT 1 FROM day_workout_items i WHERE i.user_id = days.user_id AND i.date = days.date);
