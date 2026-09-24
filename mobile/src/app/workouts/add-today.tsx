import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';

import { ApiError, api } from '@/api/client';
import { defaultExercisePrescription, ExerciseLibrary, type Exercise } from '@/components/ExerciseLibrary';
import { Screen, Title } from '@/components/ui';

export default function AddTodayWorkout() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [busy, setBusy] = useState(false);

  const add = async (exercise: Exercise) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/days/${date}/workout/items`, {
        exercise_id: exercise.id,
        ...defaultExercisePrescription(exercise.category_id),
      });
      router.back();
    } catch (error) {
      Alert.alert('加不了動作', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ 今日流程</Text>
      </Pressable>
      <Title sub="只會加入今天的訓練，不會修改原本課表。">加入動作</Title>
      <ExerciseLibrary onSelect={add} selectLabel={busy ? '加入中…' : '加入今天'} />
    </Screen>
  );
}
