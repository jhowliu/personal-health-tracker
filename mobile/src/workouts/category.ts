/** How a workout template's category reads: its name, and the tone of its tag. */
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
