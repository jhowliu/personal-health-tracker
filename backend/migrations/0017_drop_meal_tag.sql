-- The 日常／清淡／偶爾吃 tag only steered which meals the daily auto-assign dealt out.
-- With auto-assign gone (0016) nothing reads it.
-- depends: 0016_drop_auto_assign_meals

ALTER TABLE meals DROP COLUMN tag;
