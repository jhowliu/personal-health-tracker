import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Card, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Workout = Schema<'WorkoutExecutionOut'>;

export default function SaveTodayWorkout() {
  const { t } = useI18n();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    let live = true;
    api.get(`/days/${date}/workout`).then((result: Workout) => {
      if (!live) return;
      setWorkout(result);
      setName(result.template ? t('workouts.saveToday.myVersion', { name: result.template.name }) : t('workouts.saveToday.fallbackName', { date }));
    }).catch((error) =>
      Alert.alert(t('workouts.saveToday.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'), [
        { text: t('meals.photo.returnToToday'), onPress: () => backOrReplace('/today') },
      ]),
    );
    return () => { live = false; };
  }, [date, t]);

  const save = async () => {
    if (!date || !name.trim()) return;
    setBusy(true);
    try {
      const saved = (await api.post(
        `/days/${date}/workout/save-as-template`,
        { name: name.trim() },
      )) as Schema<'TemplateOut'>;
      router.replace({ pathname: '/workouts/[id]', params: { id: saved.id } });
    } catch (error) {
      Alert.alert(t('workouts.saveToday.saveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  if (!workout) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={color.primary} /></View>
      </Screen>
    );
  }

  return (
    <Screen footer={<PrimaryButton onPress={save} disabled={!name.trim() || !workout.items.length} busy={busy}>{t('workouts.saveToday.action')}</PrimaryButton>}>
      <BackLink label={t('common.labels.today')} disabled={busy} onPress={() => backOrReplace('/today')} />
      <Title sub={t('workouts.saveToday.subtitle', { day: date ? dayWord(date) : t('common.labels.today') })}>
        {t('workouts.saveToday.title')}
      </Title>
      <Field label={t('workouts.saveToday.templateName')} value={name} onChangeText={setName} placeholder={t('workouts.saveToday.namePlaceholder')} />
      <Card className="gap-2">
        <Text className="text-base text-ink">
          {t(workout.items.length === 1 ? 'common.counts.exercises.one' : 'common.counts.exercises.other', { count: workout.items.length })}
        </Text>
        {workout.items.map(({ item }, index) => (
          <Hint key={item.id}>{index + 1}. {item.exercise_name}</Hint>
        ))}
      </Card>
    </Screen>
  );
}
