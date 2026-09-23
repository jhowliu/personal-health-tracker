/**
 * The meal being edited, shared across the edit / add-food / substitute screens.
 *
 * Expo Router has no way to hand a value back when a pushed screen pops, so the draft
 * lives here instead of being threaded through route params. Screens read it with
 * `useDraft()` and change it through the named actions — none of them splice arrays.
 *
 * Grams here are always *baseline* grams, the same thing the server stores. carb_scale
 * is applied when a day is planned, never to the template being edited.
 */
import { useSyncExternalStore } from 'react';

import type { Schema } from '@/api/client';

type Food = Schema<'FoodOut'>;
type Meal = Schema<'MealOut'>;

export type DraftItem = {
  /** Local key; a saved meal's item id when it came from the server. */
  key: string;
  food: Food;
  grams: number;
};

export type Draft = {
  id: string | null;
  name: string;
  tag: 'regular' | 'light' | 'occasional';
  mealTimes: ('breakfast' | 'lunch' | 'dinner')[];
  items: DraftItem[];
};

const EMPTY: Draft = { id: null, name: '', tag: 'regular', mealTimes: ['lunch'], items: [] };

let current: Draft = EMPTY;
const listeners = new Set<() => void>();

function commit(next: Draft) {
  current = next;
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let counter = 0;
const nextKey = () => `draft-${counter++}`;

export const draft = {
  /** Begin editing — an existing meal, or a blank one when given null. */
  start(meal: Meal | null) {
    commit(
      meal
        ? {
            id: meal.id,
            name: meal.name,
            tag: meal.tag as Draft['tag'],
            mealTimes: meal.meal_times as Draft['mealTimes'],
            items: meal.items.map((item) => ({
              key: item.id,
              food: item.food,
              grams: item.grams,
            })),
          }
        : { ...EMPTY, items: [] },
    );
  },

  set(changes: Partial<Omit<Draft, 'items'>>) {
    commit({ ...current, ...changes });
  },

  toggleMealTime(slot: Draft['mealTimes'][number]) {
    const has = current.mealTimes.includes(slot);
    const mealTimes = has
      ? current.mealTimes.filter((s) => s !== slot)
      : [...current.mealTimes, slot];
    // A meal nobody can be served is not worth saving, so never empty the list.
    commit({ ...current, mealTimes: mealTimes.length ? mealTimes : current.mealTimes });
  },

  addItem(food: Food, grams: number) {
    commit({ ...current, items: [...current.items, { key: nextKey(), food, grams }] });
  },

  setGrams(key: string, grams: number) {
    commit({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, grams } : item)),
    });
  },

  replaceItem(key: string, food: Food, grams: number) {
    commit({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, food, grams } : item)),
    });
  },

  removeItem(key: string) {
    commit({ ...current, items: current.items.filter((item) => item.key !== key) });
  },

  /** The shape POST/PATCH /meals expects. */
  payload() {
    return {
      name: current.name,
      tag: current.tag,
      meal_times: current.mealTimes,
      items: current.items.map((item) => ({ food_id: item.food.id, grams: item.grams })),
    };
  },
};

export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, () => current);
}
