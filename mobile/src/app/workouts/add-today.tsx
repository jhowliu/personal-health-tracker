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
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Workout = Schema<'WorkoutExecutionOut'>;

export default function AddTodayWorkout() {
  // from=focus: opened mid-workout from focus mode, which is where Back returns to.
  const { date, from } = useLocalSearchParams<{ date: string; from?: string }>();
  const backLabel = from === 'focus' ? '回到訓練' : '今天';
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [busy, setBusy] = useState(false);
  const word = date ? dayWord(date) : '今天';

  useEffect(() => {
    if (!date) {
      Alert.alert('找不到日期', '請回到今日流程重新操作。', [
        { text: '返回今天', onPress: () => backOrReplace('/today') },
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
        Alert.alert(`讀不到${dayWord(date)}的訓練`, error instanceof ApiError ? error.message : '請稍後再試。', [
          { text: '返回今天', onPress: () => backOrReplace('/today') },
        ]),
      );
    return () => {
      live = false;
    };
  }, [date]);

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
      Alert.alert('加不了動作', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-base text-ink">
            {word}共 <Text className="text-2xl text-primary">{workout?.items.length ?? 0}</Text> 個動作
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => backOrReplace('/today')}
            disabled={busy}
            className={`min-h-[44px] flex-row items-center justify-center gap-1 rounded-control border-[1.5px] border-edge bg-primary px-4 ${
              busy ? 'opacity-40' : 'active:opacity-80'
            }`}
          >
            <Text className="text-sm text-white">{from === 'focus' ? '回到訓練' : `查看${word}的訓練`}</Text>
            <ChevronIcon direction="right" size={16} tint={color.surface} />
          </Pressable>
        </View>
      }
    >
      <BackLink label={backLabel} onPress={() => backOrReplace('/today')} disabled={busy} />
      <Title sub={`只會加入${word}的訓練，不會修改原本課表。`}>加入動作</Title>
      <ExerciseLibrary onSelect={add} selectLabel={busy ? '加入中…' : `加入${word}`} addedIds={addedIds} />
    </Screen>
  );
}
