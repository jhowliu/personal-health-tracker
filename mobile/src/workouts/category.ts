/** How a workout template's category reads: its name, and the tone of its tag. */
export const WORKOUT_CATEGORY = {
  strength: { label: '肌力', tone: 'primary' as const },
  cardio: { label: '有氧', tone: 'good' as const },
  mobility: { label: '伸展', tone: 'neutral' as const },
};

export function workoutCategory(id: string) {
  return WORKOUT_CATEGORY[id as keyof typeof WORKOUT_CATEGORY];
}
