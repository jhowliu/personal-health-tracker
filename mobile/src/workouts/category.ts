/** How a workout template reads: its category's name and tag tone, and a one-line summary. */
import type { Schema } from '@/api/client';
import { translate } from '@/i18n/translator';

const WORKOUT_CATEGORY_TONE = {
  strength: 'primary',
  cardio: 'good',
  mobility: 'neutral',
} as const;

export function workoutCategory(id: string) {
  const tone = WORKOUT_CATEGORY_TONE[id as keyof typeof WORKOUT_CATEGORY_TONE];
  if (!tone) return undefined;
  const labels = {
    strength: translate('common.workoutCategories.strength'),
    cardio: translate('common.workoutCategories.cardio'),
    mobility: translate('common.workoutCategories.mobility'),
  } satisfies Record<keyof typeof WORKOUT_CATEGORY_TONE, string>;
  return { label: labels[id as keyof typeof labels], tone };
}

/** "6 exercises, about 45 min": what a plan holds, for a line under its name. */
export function describePlan(template: Schema<'TemplateOut'>): string {
  const minutes = template.duration_min
    ? translate('workouts.home.approximateMinutes', { count: template.duration_min })
    : '';
  return translate('workouts.home.summary', { count: template.items.length, minutes });
}
