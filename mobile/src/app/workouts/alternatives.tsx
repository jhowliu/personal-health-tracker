import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Card, Chip, Empty, Hint, Rows, Screen, Title } from '@/components/ui';
import { color } from '@/theme/tokens';
import { replacement } from '@/workouts/replacement';

type Alternative = {
  exercise: { id: string; name: string; description: string | null; category_id: string; body_region: string | null; equipment: string | null };
  recommended: boolean;
  hint: string;
};

const REASONS = [
  { id: 'equipment', label: '沒有器材' },
  { id: 'pain', label: '不舒服' },
  { id: 'variety', label: '想換動作' },
] as const;

export default function WorkoutAlternatives() {
  const { exercise_id, item_index, name } = useLocalSearchParams<{
    exercise_id: string;
    item_index?: string;
    name?: string;
  }>();
  const [reason, setReason] = useState<(typeof REASONS)[number]['id']>('equipment');
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null);

  useEffect(() => {
    api
      .get(`/exercises/${exercise_id}/alternatives?reason=${reason}`)
      .then((result: Alternative[]) => setAlternatives(result))
      .catch((error) => Alert.alert('讀不到替代動作', error instanceof ApiError ? error.message : '請稍後再試'));
  }, [exercise_id, reason]);

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text className="text-base text-primary">‹ 課表</Text>
      </Pressable>
      <Title sub="選擇後只會更新目前課表草稿；不會改動已排定的當日訓練。">替代 {name ?? '動作'}</Title>
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
              <View key={alternative.exercise.id} className="gap-1 py-3">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-base font-semibold text-ink">{alternative.exercise.name}</Text>
                  {alternative.recommended ? <Chip label="最推薦" tone="good" /> : null}
                </View>
                {alternative.exercise.description ? <Hint>{alternative.exercise.description}</Hint> : null}
                <Hint>{alternative.hint}</Hint>
                {item_index !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      replacement.choose({
                        index: Number(item_index),
                        exercise_id: alternative.exercise.id,
                        exercise_name: alternative.exercise.name,
                      });
                      router.back();
                    }}
                    className="min-h-[44px] justify-center"
                  >
                    <Text className="text-base text-primary">換成這個動作</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}
