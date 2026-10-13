import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { ChevronIcon } from '@/components/icons';
import { defaultExercisePrescription, ExerciseLibrary, type Exercise } from '@/components/ExerciseLibrary';
import { Text } from '@/components/text';
import { BackLink, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Workout = Schema<'WorkoutExecutionOut'>;

export default function AddTodayWorkout() {
  const { t } = useI18n();
  // from=focus: opened mid-workout from focus mode, which is where Back returns to.
  const { date, from } = useLocalSearchParams<{ date: string; from?: string }>();
  const backLabel = from === 'focus' ? t('workouts.addToday.backToWorkout') : t('common.labels.today');
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);
  const word = date ? dayWord(date) : t('common.labels.today');

  useEffect(() => {
    if (!date) {
      Alert.alert(t('workouts.addToday.missingDateTitle'), t('workouts.addToday.missingDateBody'), [
        { text: t('meals.photo.returnToToday'), onPress: () => backOrReplace('/today') },
      ]);
      return;
    }
    let live = true;
    api
      .get(`/days/${date}/workout`)
      .then((result: Workout) => {
        if (live) setWorkout(result);
      })
      .catch((error) =>
        Alert.alert(t('workouts.focus.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'), [
          { text: t('meals.photo.returnToToday'), onPress: () => backOrReplace('/today') },
        ]),
      );
    return () => {
      live = false;
    };
  }, [date, t]);

  // An exercise can be in today's workout only once, so the ones already there are not offered again.
  const addedIds = useMemo(
    () => new Set(workout?.items.map(({ item }) => item.exercise_id) ?? []),
    [workout],
  );

  const add = async (exercise: Exercise) => {
    if (busy || !workout || addedIds.has(exercise.id)) return;
    setBusy(true);
    try {
      await api.post(`/days/${date}/workout/items`, {
        exercise_id: exercise.id,
        ...defaultExercisePrescription(exercise.category_id),
      });
      setWorkout((await api.get(`/days/${date}/workout`)) as Workout);
    } catch (error) {
      Alert.alert(t('workouts.addToday.addFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-base text-ink">
            {t('workouts.addToday.dayTotal', { day: word, count: workout?.items.length ?? 0 })}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => backOrReplace('/today')}
            disabled={busy}
            className={`min-h-[44px] flex-row items-center justify-center gap-1 rounded-control border-[1.5px] border-edge bg-primary px-4 ${
              busy ? 'opacity-40' : 'active:opacity-80'
            }`}
          >
            <Text className="text-sm text-white">
              {from === 'focus' ? t('workouts.addToday.backToWorkout') : t('workouts.addToday.viewDayWorkout', { day: word })}
            </Text>
            <ChevronIcon direction="right" size={16} tint={color.surface} />
          </Pressable>
        </View>
      }
    >
      <BackLink label={backLabel} onPress={() => backOrReplace('/today')} disabled={busy} />
      <Title sub={t('workouts.addToday.subtitle', { day: word })}>{t('workouts.addToday.title')}</Title>
      <ExerciseLibrary
        onSelect={add}
        selectLabel={busy ? t('common.states.adding') : t('workouts.addToday.addToDay', { day: word })}
        addedIds={addedIds}
      />
    </Screen>
  );
}
