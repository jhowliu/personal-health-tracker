/**
 * Meals being edited, shared across the edit / add-food / substitute screens.
 *
 * Expo Router has no way to hand a value back when a pushed screen pops, so the draft
 * live here instead of being threaded through route params. Each draft is keyed by the
 * meal route id so two mounted editors can never write through the same mutable state.
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

const drafts = new Map<string, Draft>();
const baselines = new Map<string, string>();
const listeners = new Set<() => void>();

function commit(key: string, next: Draft) {
  drafts.set(key, next);
  listeners.forEach((notify) => notify());
}

function get(key: string): Draft {
  return drafts.get(key) ?? EMPTY;
}

function requireDraft(key: string): Draft {
  const current = drafts.get(key);
  if (!current) throw new Error('找不到目前餐點草稿，請回到餐點頁重新開啟。');
  return current;
}

function serialise(value: Draft) {
  return JSON.stringify(value);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let counter = 0;
const nextKey = () => `draft-${counter++}`;

export const draft = {
  has(key: string) {
    return drafts.has(key);
  },

  /** Begin editing — an existing meal, or a blank one when given null. */
  start(key: string, meal: Meal | null) {
    const next: Draft =
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
        : { ...EMPTY, items: [] };
    drafts.set(key, next);
    baselines.set(key, serialise(next));
    listeners.forEach((notify) => notify());
  },

  set(key: string, changes: Partial<Omit<Draft, 'items'>>) {
    commit(key, { ...requireDraft(key), ...changes });
  },

  toggleMealTime(key: string, slot: Draft['mealTimes'][number]) {
    const current = requireDraft(key);
    const has = current.mealTimes.includes(slot);
    const mealTimes = has
      ? current.mealTimes.filter((s) => s !== slot)
      : [...current.mealTimes, slot];
    // A meal nobody can be served is not worth saving, so never empty the list.
    commit(key, { ...current, mealTimes: mealTimes.length ? mealTimes : current.mealTimes });
  },

  addItem(key: string, food: Food, grams: number) {
    const current = requireDraft(key);
    commit(key, { ...current, items: [...current.items, { key: nextKey(), food, grams }] });
  },

  setGrams(draftKey: string, itemKey: string, grams: number) {
    const current = requireDraft(draftKey);
    commit(draftKey, {
      ...current,
      items: current.items.map((item) => (item.key === itemKey ? { ...item, grams } : item)),
    });
  },

  replaceItem(draftKey: string, itemKey: string, food: Food, grams: number) {
    const current = requireDraft(draftKey);
    commit(draftKey, {
      ...current,
      items: current.items.map((item) => (item.key === itemKey ? { ...item, food, grams } : item)),
    });
  },

  removeItem(draftKey: string, itemKey: string) {
    const current = requireDraft(draftKey);
    commit(draftKey, { ...current, items: current.items.filter((item) => item.key !== itemKey) });
  },

  /** The shape POST/PATCH /meals expects. */
  payload(key: string) {
    const current = requireDraft(key);
    return {
      name: current.name,
      tag: current.tag,
      meal_times: current.mealTimes,
      items: current.items.map((item) => ({ food_id: item.food.id, grams: item.grams })),
    };
  },

  isDirty(key: string) {
    const current = drafts.get(key);
    return Boolean(current && baselines.get(key) !== serialise(current));
  },

  clear(key: string) {
    drafts.delete(key);
    baselines.delete(key);
    listeners.forEach((notify) => notify());
  },

  clearAll() {
    drafts.clear();
    baselines.clear();
    listeners.forEach((notify) => notify());
  },
};

export function useDraft(key: string): Draft {
  return useSyncExternalStore(subscribe, () => get(key));
}
