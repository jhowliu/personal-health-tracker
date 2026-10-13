import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Chip, Empty, Hint, Rows, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';
import { replacement } from '@/workouts/replacement';

type Alternative = {
  exercise: { id: string; name: string; description: string | null; category_id: string; body_region: string | null; equipment: string | null };
  recommended: boolean;
  hint: string;
};

const REASONS = ['equipment', 'pain', 'variety'] as const;

export default function WorkoutAlternatives() {
  const { t } = useI18n();
  const { template_id: templateId, exercise_id, item_index, name } = useLocalSearchParams<{
    template_id: string;
    exercise_id: string;
    item_index?: string;
    name?: string;
  }>();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('equipment');
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);

  useEffect(() => {
    if (!templateId || !exercise_id || item_index === undefined || !Number.isInteger(Number(item_index))) {
      Alert.alert(t('workouts.replacement.missingTemplateExerciseTitle'), t('workouts.replacement.missingTemplateExerciseBody'), [
        { text: t('workouts.editor.returnToWorkouts'), onPress: () => router.replace('/workouts') },
      ]);
    }
  }, [exercise_id, item_index, t, templateId]);

  useEffect(() => {
    api
      .get(`/exercises/${exercise_id}/alternatives?reason=${reason}`)
      .then((result: Alternative[]) => setAlternatives(result))
      .catch((error) => Alert.alert(t('workouts.replacement.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgainNoStop')));
  }, [exercise_id, reason, t]);

  return (
    <Screen>
      <BackLink
        label={t('navigation.workouts')}
        onPress={() =>
          backOrReplace({ pathname: '/workouts/[id]', params: { id: templateId ?? 'new' } })
        }
      />
      <Title sub={t('workouts.replacement.templateSubtitle')}>
        {t('workouts.replacement.title', { name: name ?? t('workouts.library.exerciseFallback') })}
      </Title>
      <View className="flex-row flex-wrap gap-2">
        {REASONS.map((option) => (
          <Chip
            key={option}
            label={t(option === 'equipment' ? 'workouts.replacement.equipment' : option === 'pain' ? 'workouts.replacement.discomfort' : 'workouts.replacement.variety')}
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
              <View key={alternative.exercise.id} className="flex-row items-start gap-3 py-3">
                <ExerciseFigure exerciseId={alternative.exercise.id} name={alternative.exercise.name} mode="single" />
                <View className="flex-1 gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base text-ink">{alternative.exercise.name}</Text>
                  {alternative.recommended ? <Chip label={t('common.states.mostRecommended')} tone="good" /> : null}
                </View>
                {alternative.exercise.description ? <Hint>{alternative.exercise.description}</Hint> : null}
                <Hint>{alternative.hint}</Hint>
                {item_index !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      replacement.choose({
                        templateId,
                        index: Number(item_index),
                        exercise_id: alternative.exercise.id,
                        exercise_name: alternative.exercise.name,
                      });
                       backOrReplace({ pathname: '/workouts/[id]', params: { id: templateId } });
                    }}
                    className="min-h-[44px] justify-center"
                  >
                    <Text className="text-base text-primary">{t('workouts.replacement.replaceAction')}</Text>
                  </Pressable>
                ) : null}
                </View>
              </View>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}
