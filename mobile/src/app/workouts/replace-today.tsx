import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Card, Chip, Empty, Hint, Rows, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';
import { backOrReplace } from '@/navigation/back';

type Reason = 'equipment_occupied' | 'knee_discomfort' | 'missing_equipment' | 'variety';
type Alternative = {
  exercise: { id: string; name: string; description: string | null };
  recommended: boolean;
  hint: string;
};

const REASONS: { id: Reason; label: string }[] = [
  { id: 'equipment_occupied', label: '器材有人用' },
  { id: 'knee_discomfort', label: '膝蓋不舒服' },
  { id: 'missing_equipment', label: '沒有器材' },
  { id: 'variety', label: '想換動作' },
];

export default function ReplaceTodayWorkout() {
  const { date, item_id: itemId, exercise_id: exerciseId, name } = useLocalSearchParams<{
    date: string;
    item_id: string;
    exercise_id: string;
    name?: string;
  }>();
  const [reason, setReason] = useState<Reason>('equipment_occupied');
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);
  const [busy, setBusy] = useState(false);
  const loadVersion = useRef(0);

  useEffect(() => {
    if (!date || !itemId || !exerciseId) {
      Alert.alert('找不到今日動作', '請回到今日流程重新選擇動作。', [
        { text: '返回今天', onPress: () => router.replace('/today') },
      ]);
    }
  }, [date, exerciseId, itemId]);

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const version = ++loadVersion.current;
    try {
      setAlternatives(null);
      const result = await api.get(`/exercises/${exerciseId}/alternatives?reason=${reason}`);
      if (version === loadVersion.current) setAlternatives(result);
    } catch (error) {
      Alert.alert('讀不到替代動作', error instanceof ApiError ? error.message : '請稍後再試');
      setAlternatives([]);
    }
  }, [exerciseId, reason]);

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
      Alert.alert('換不了動作', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => backOrReplace('/today')} disabled={busy}>
        <Text className="text-base text-primary">‹ 今日流程</Text>
      </Pressable>
      <Title sub="只換今天這一次，不會改到原本課表。">替代 {name ?? '動作'}</Title>
      <View className="flex-row flex-wrap gap-2">
        {REASONS.map((option) => (
          <Chip key={option.id} label={option.label} selected={reason === option.id} onPress={() => setReason(option.id)} />
        ))}
      </View>

      {alternatives === null ? (
        <ActivityIndicator color={color.primary} />
      ) : alternatives.length === 0 ? (
        <Empty>找不到合適的替代動作</Empty>
      ) : (
        <Card className="px-4 py-0">
          <Rows>
            {alternatives.map((alternative) => (
              <Pressable
                key={alternative.exercise.id}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => replace(alternative.exercise.id)}
                className={`min-h-[64px] gap-1 py-3 ${busy ? 'opacity-40' : ''}`}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base font-semibold text-ink">{alternative.exercise.name}</Text>
                  {alternative.recommended ? <Chip label="推薦" tone="good" /> : null}
                </View>
                {alternative.exercise.description ? <Hint>{alternative.exercise.description}</Hint> : null}
                <Hint>{alternative.hint}</Hint>
                <Text className="text-base text-primary">換成這個動作</Text>
              </Pressable>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}
