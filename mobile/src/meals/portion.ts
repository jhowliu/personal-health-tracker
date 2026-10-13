/**
 * Portions are stored in grams but shown in the unit a food is eaten in: 顆, 匙, 碗, or plain
 * grams. Every screen that shows or edits a portion goes through here, so the same food
 * never reads "60 g" in one place and "2 顆" in another.
 */
import { translate } from '@/i18n/translator';

type PortionFood = { unit: string; grams_per_unit: number | null };

type Per100g = { kcal: number; protein_g: number; fat_g: number; carb_g: number };

function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    g: translate('common.units.gram'),
    ml: 'ml',
    piece: translate('common.units.piece'),
    scoop: translate('common.units.scoop'),
    bowl: translate('common.units.bowl'),
  };
  return labels[unit] ?? unit;
}

/** The unit a portion is shown in, and how many grams one of it weighs. */
export function portionUnit(food: PortionFood | null | undefined): {
  label: string;
  gramsPerUnit: number;
} {
  if (food?.grams_per_unit && food.unit !== 'g') {
    return { label: unitLabel(food.unit), gramsPerUnit: food.grams_per_unit };
  }
  return { label: translate('common.units.gram'), gramsPerUnit: 1 };
}

/** One decimal at most, and no trailing ".0". */
export function readableAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function gramsToAmount(food: PortionFood | null | undefined, grams: number): number {
  return grams / portionUnit(food).gramsPerUnit;
}

export function amountToGrams(food: PortionFood | null | undefined, amount: number): number {
  return amount * portionUnit(food).gramsPerUnit;
}

/** "2 顆", "1.5 匙", "60 g". */
export function formatPortion(food: PortionFood | null | undefined, grams: number): string {
  return `${readableAmount(gramsToAmount(food, grams))} ${portionUnit(food).label}`;
}

/** The nutrition line under a food's name: per piece for foods sold by the piece, else per 100 g. */
export function describeFood(food: PortionFood & { per_100g: Per100g }): string {
  const perPiece = Boolean(food.grams_per_unit) && food.unit === 'piece';
  const base = perPiece
    ? translate('meals.portion.perPiece', { grams: food.grams_per_unit })
    : translate('meals.portion.perHundred');
  const factor = perPiece && food.grams_per_unit ? food.grams_per_unit / 100 : 1;
  const round = (n: number) => Math.round(n * factor);
  const { kcal, protein_g, fat_g, carb_g } = food.per_100g;
  return translate('meals.portion.nutritionSummary', {
    base,
    calories: round(kcal),
    protein: round(protein_g),
    fat: round(fat_g),
    carbs: round(carb_g),
  });
}
