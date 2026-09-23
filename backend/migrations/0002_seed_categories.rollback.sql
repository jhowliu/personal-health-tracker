DELETE FROM translations WHERE key LIKE 'food_category.%' OR key LIKE 'exercise_category.%';
DELETE FROM exercise_categories;
DELETE FROM food_categories;
