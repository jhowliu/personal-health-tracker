-- 固定資料:食物分類、運動分類與其翻譯
-- depends: 0001_init

INSERT INTO food_categories (id, name_key, swap_by, sort_order) VALUES
  ('staple',    'food_category.staple.name',    'carb',    1),
  ('protein',   'food_category.protein.name',   'protein', 2),
  ('vegetable', 'food_category.vegetable.name', 'kcal',    3),
  ('fruit',     'food_category.fruit.name',     'carb',    4),
  ('fat_sauce', 'food_category.fat_sauce.name', 'kcal',    5);

INSERT INTO exercise_categories (id, name_key, sort_order) VALUES
  ('strength', 'exercise_category.strength.name', 1),
  ('cardio',   'exercise_category.cardio.name',   2),
  ('mobility', 'exercise_category.mobility.name', 3);

INSERT INTO translations (key, locale, text) VALUES
  ('food_category.staple.name',    'zh-TW', '主食'),
  ('food_category.staple.name',    'en',    'Staples'),
  ('food_category.protein.name',   'zh-TW', '蛋白質'),
  ('food_category.protein.name',   'en',    'Protein'),
  ('food_category.vegetable.name', 'zh-TW', '蔬菜'),
  ('food_category.vegetable.name', 'en',    'Vegetables'),
  ('food_category.fruit.name',     'zh-TW', '水果'),
  ('food_category.fruit.name',     'en',    'Fruit'),
  ('food_category.fat_sauce.name', 'zh-TW', '油脂與醬料'),
  ('food_category.fat_sauce.name', 'en',    'Fats & sauces'),
  ('exercise_category.strength.name', 'zh-TW', '肌力'),
  ('exercise_category.strength.name', 'en',    'Strength'),
  ('exercise_category.cardio.name',   'zh-TW', '有氧'),
  ('exercise_category.cardio.name',   'en',    'Cardio'),
  ('exercise_category.mobility.name', 'zh-TW', '伸展'),
  ('exercise_category.mobility.name', 'en',    'Mobility');
