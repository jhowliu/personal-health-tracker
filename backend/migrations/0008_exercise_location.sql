-- Where an exercise can be done, stated per exercise rather than guessed from equipment.
--
-- Equipment does not decide this: a treadmill can sit in a spare room, plenty of people
-- own a barbell, and a cable stack is never at home. It is a judgement call, so it is
-- data. Built-ins carry it from the seed; custom exercises leave it null until asked.
-- depends: 0007_schedule_without_location

ALTER TABLE exercises ADD COLUMN location TEXT CHECK (
  location IS NULL OR location IN ('home', 'gym', 'both')
);
