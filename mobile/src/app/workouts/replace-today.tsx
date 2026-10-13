import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Chip, Empty, Hint, Rows, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';

type Reason = 'equipment_occupied' | 'knee_discomfort' | 'missing_equipment' | 'variety';
type Alternative = {
  exercise: { id: string; name: string; description: string | null };
  recommended: boolean;
  hint: string;
};

const REASONS: Reason[] = ['equipment_occupied', 'knee_discomfort', 'missing_equipment', 'variety'];

export default function ReplaceTodayWorkout() {
  const { t } = useI18n();
  const { date, item_id: itemId, exercise_id: exerciseId, name, from } = useLocalSearchParams<{
    date: string;
    item_id: string;
    exercise_id: string;
    name?: string;
    /** 'focus' when opened mid-workout from focus mode, which is where Back returns to. */
    from?: string;
  }>();
  const [reason, setReason] = useState<Reason>('equipment_occupied');
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);

  useEffect(() => {
    if (!date || !itemId || !exerciseId) {
      Alert.alert(t('workouts.replacement.missingTodayExerciseTitle'), t('workouts.replacement.missingTodayExerciseBody'), [
        { text: t('meals.photo.returnToToday'), onPress: () => router.replace('/today') },
      ]);
    }
  }, [date, exerciseId, itemId, t]);

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const version = ++loadVersion.current;
    try {
      setAlternatives(null);
      const result = await api.get(`/exercises/${exerciseId}/alternatives?reason=${reason}`);
      if (version === loadVersion.current) setAlternatives(result);
    } catch (error) {
      Alert.alert(t('workouts.replacement.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
      setAlternatives([]);
    }
  }, [exerciseId, reason, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const replace = async (exerciseId: string) => {
    setBusy(true);
    try {
      await api.patch(`/days/${date}/workout/items/${itemId}`, {
        exercise_id: exerciseId,
        replacement_reason: reason,
      });
      backOrReplace('/today');
    } catch (error) {
      Alert.alert(t('workouts.replacement.replaceFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BackLink
        label={from === 'focus' ? t('workouts.addToday.backToWorkout') : t('common.labels.today')}
        onPress={() => backOrReplace('/today')}
        disabled={busy}
      />
      <Title sub={t('workouts.replacement.todaySubtitle', { day: date ? dayWord(date) : t('common.labels.today') })}>
        {t('workouts.replacement.title', { name: name ?? t('workouts.library.exerciseFallback') })}
      </Title>
      <View className="flex-row flex-wrap gap-2">
        {REASONS.map((option) => (
          <Chip
            key={option}
            label={t({
              equipment_occupied: 'workouts.replacement.occupied',
              knee_discomfort: 'workouts.replacement.kneeDiscomfort',
              missing_equipment: 'workouts.replacement.equipment',
              variety: 'workouts.replacement.variety',
            }[option] as 'workouts.replacement.occupied')}
            selected={reason === option}
            onPress={() => setReason(option)}
          />
        ))}
      </View>

      {alternatives === null ? (
        <ActivityIndicator color={color.primary} />
      ) : alternatives.length === 0 ? (
        <Empty>{t('workouts.replacement.noResults')}</Empty>
      ) : (
        <Card className="px-4 py-0">
          <Rows>
            {alternatives.map((alternative) => (
              <Pressable
                key={alternative.exercise.id}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => replace(alternative.exercise.id)}
                className={`min-h-[64px] flex-row items-start gap-3 py-3 ${busy ? 'opacity-40' : ''}`}
              >
                <ExerciseFigure exerciseId={alternative.exercise.id} name={alternative.exercise.name} mode="single" />
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-base text-ink">{alternative.exercise.name}</Text>
                    {alternative.recommended ? <Chip label={t('common.states.recommended')} tone="good" /> : null}
                  </View>
                  {alternative.exercise.description ? <Hint>{alternative.exercise.description}</Hint> : null}
                  <Hint>{alternative.hint}</Hint>
                  <Text className="text-base text-primary">{t('workouts.replacement.replaceAction')}</Text>
                </View>
              </Pressable>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}
