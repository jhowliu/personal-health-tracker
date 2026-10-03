-- The calorie target now adds the day's own workout on top of a base, so:
-- * activity_level means daily life without exercise. Every existing answer was given as
--   "how many days a week I train", which would now count training twice; all restart at
--   sedentary and can be changed in settings.
-- * meal portions no longer follow the target, so the carb baseline and its switch go.
-- depends: 0018_kettlebell_equipment

UPDATE profiles SET activity_level = 'sedentary';
ALTER TABLE profiles DROP COLUMN carb_base_g;
ALTER TABLE profiles DROP COLUMN auto_scale_carbs;
