DELETE FROM translations
WHERE locale = 'en'
  AND (key LIKE 'food.%.name' OR key LIKE 'workout_template.%.name');
