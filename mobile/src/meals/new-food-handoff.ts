/**
 * A food created from 加入食物's empty search, on its way back to that screen.
 *
 * Expo Router has no way to hand a value back when a pushed screen pops, so the new food
 * waits here until 加入食物 regains focus and adds it. Taking it clears it, so it is added
 * once.
 */
import type { Schema } from '@/api/client';

type Food = Schema<'FoodOut'>;

let pending: Food | null = null;

export const newFoodHandoff = {
  set(food: Food) {
    pending = food;
  },
  take(): Food | null {
    const food = pending;
    pending = null;
    return food;
  },
};
