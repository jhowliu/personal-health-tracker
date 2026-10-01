import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { BackLink, Card, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { dayWord } from '@/dates';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

type Workout = Schema<'WorkoutExecutionOut'>;

export default function SaveTodayWorkout() {
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
      setName(result.template ? `${result.template.name}・我的版本` : `${date} 的訓練`);
    }).catch((error) =>
      Alert.alert('讀不到今天的訓練', error instanceof ApiError ? error.message : '請稍後再試。', [
        { text: '返回今天', onPress: () => backOrReplace('/today') },
      ]),
    );
    return () => { live = false; };
  }, [date]);

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
      Alert.alert('另存失敗', error instanceof ApiError ? error.message : '請稍後再試。');
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
    <Screen footer={<PrimaryButton onPress={save} disabled={!name.trim() || !workout.items.length} busy={busy}>儲存為我的課表</PrimaryButton>}>
      <BackLink label="今天" disabled={busy} onPress={() => backOrReplace('/today')} />
      <Title sub={`從${date ? dayWord(date) : '今天'}調整後的動作建立新課表；不會修改原課表或每週排程。`}>另存課表</Title>
      <Field label="課表名稱" value={name} onChangeText={setName} placeholder="我的全身訓練" />
      <Card className="gap-2">
        <Text className="text-base font-semibold text-ink">{workout.items.length} 個動作</Text>
        {workout.items.map(({ item }, index) => (
          <Hint key={item.id}>{index + 1}. {item.exercise_name}</Hint>
        ))}
      </Card>
    </Screen>
  );
}
