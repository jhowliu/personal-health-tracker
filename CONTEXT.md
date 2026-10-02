# Personal Health Tracker

A single-user-per-account tracker for body metrics, eaten meals and workouts, organised around one calendar Day at a time. Meals are logged after cooking, mostly from a photo; nothing is dealt into a Day ahead of time.

## Language

**Day**:
One user's calendar date, opened the first time it is looked at and never opened twice.
_Avoid_: Session, journal entry

**Opening a day**:
Materialising a Day the first time it is viewed or written: its meal slots, its scheduled workout, and the user's workout time. Idempotent.
_Avoid_: Creating a day, initialising a day

**Meal slot**:
One of breakfast, lunch or dinner within a Day, holding the Plate items logged for it and an eaten or skipped state. Starts empty.
_Avoid_: Meal time, meal period

**Saved meal**:
A named set of Foods at portions that the user keeps (我的餐點), to put on a Meal slot whole instead of logging it food by food. Putting one on a slot copies its items; later edits to the Saved meal do not reach that slot.
_Avoid_: Template, recipe, planned meal

**Extras**:
Food recorded after the fact outside the three Meal slots, such as a photographed snack. Counts as eaten the moment it is saved.
_Avoid_: Snacks, unplanned meals

**Plate item**:
One food (from the catalog, or custom with fixed nutrition) at a portion in grams, inside a Meal slot or Extras.
_Avoid_: Planned item, extra item, meal item

**Food**:
An entry in a user's own catalog, seeded from shared templates at sign-up and freely editable afterwards.
_Avoid_: Custom food, built-in food

**Frozen nutrition**:
The nutrition of a Plate item as recorded when it was eaten. Later edits to the Food do not change it; changing the portion rescales it proportionally.
_Avoid_: Snapshot, cached nutrition

**Planned nutrition**:
The total of a Day's non-skipped Meal slots plus Extras.
_Avoid_: Plan total

**Eaten nutrition**:
The total of a Day's eaten Meal slots plus Extras.
_Avoid_: Consumed, flow total

**Day flow**:
The ordered steps a Day walks through (body log, meals, workout) and which are complete.
_Avoid_: Timeline, checklist

**Streak**:
Consecutive days on which the body was logged and all three Meal slots were eaten or skipped, counted back from a given date. A date that is not finished yet does not break it; the count then ends on the day before.
_Avoid_: Chain, run
