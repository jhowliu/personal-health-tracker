import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Card, Chip, Field, Hint } from '@/components/ui';
import { color } from '@/theme/tokens';

export type Exercise = Schema<'ExerciseOut'>;

export function ExerciseLibrary({
  onSelect,
  selectLabel = '加入',
}: {
  onSelect: (exercise: Exercise) => void;
  selectLabel?: string;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [bodyRegion, setBodyRegion] = useState('all');
  const [equipment, setEquipment] = useState('all');

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category !== 'all') params.set('category_id', category);
        if (bodyRegion !== 'all') params.set('body_region', bodyRegion);
        if (equipment !== 'all') params.set('equipment', equipment);
        const suffix = params.size ? `?${params}` : '';
        setExercises(await api.get(`/exercises${suffix}`));
      } catch (error) {
        Alert.alert('讀不到動作庫', error instanceof ApiError ? error.message : '請稍後再試');
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [bodyRegion, category, equipment, query]);

  return (
    <Card className="gap-3 border-primary">
      <Text className="text-base font-semibold text-ink">動作庫</Text>
      <Field value={query} onChangeText={setQuery} placeholder="搜尋動作名稱" />
      <View className="gap-1">
        <Text className="text-sm text-muted">篩選</Text>
        <View className="flex-row flex-wrap gap-2">
          {['all', 'strength', 'cardio', 'mobility'].map((value) => (
            <Chip key={value} label={categoryLabel(value)} selected={category === value} onPress={() => setCategory(value)} />
          ))}
          {['all', 'upper_body', 'lower_body', 'core', 'full_body', 'mobility'].map((value) => (
            <Chip key={value} label={bodyLabel(value)} selected={bodyRegion === value} onPress={() => setBodyRegion(value)} />
          ))}
          {['all', 'bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'resistance_band', 'treadmill'].map((value) => (
            <Chip key={value} label={equipmentLabel(value)} selected={equipment === value} onPress={() => setEquipment(value)} />
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={color.primary} />
      ) : exercises.length === 0 ? (
        <Hint>找不到符合的動作，請調整搜尋或篩選。</Hint>
      ) : (
        <View className="gap-2">
          {exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              accessibilityRole="button"
              onPress={() => onSelect(exercise)}
              className="min-h-[52px] gap-1 rounded-field bg-fill px-3 py-2"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-base font-semibold text-ink">{exercise.name}</Text>
                <Text className="text-sm text-primary">{selectLabel}</Text>
              </View>
              <Text className="text-sm text-muted">
                {[categoryLabel(exercise.category_id), bodyLabel(exercise.body_region), equipmentLabel(exercise.equipment)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {exercise.description ? <Hint>{exercise.description}</Hint> : null}
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

// Cardio and mobility are timed; lifts are counted. Consumers can still edit these values.
export function defaultExercisePrescription(category: string) {
  if (category === 'strength') {
    return { sets: 3, reps: '10-12', duration_sec: null, weight_kg: null, rest_sec: 60 };
  }
  if (category === 'cardio') {
    return { sets: null, reps: null, duration_sec: 600, weight_kg: null, rest_sec: 0 };
  }
  return { sets: null, reps: null, duration_sec: 30, weight_kg: null, rest_sec: 15 };
}

function categoryLabel(value: string) {
  return { all: '全部', strength: '肌力', cardio: '有氧', mobility: '活動度' }[value] ?? value;
}

function bodyLabel(value: string | null) {
  if (!value || value === 'all') return value === 'all' ? '部位全部' : '';
  return { upper_body: '上半身', lower_body: '下半身', core: '核心', full_body: '全身', mobility: '活動度' }[value] ?? value;
}

function equipmentLabel(value: string | null) {
  if (!value || value === 'all') return value === 'all' ? '器材全部' : '';
  return {
    bodyweight: '徒手',
    dumbbell: '啞鈴',
    barbell: '槓鈴',
    machine: '器械',
    cable: '滑輪',
    resistance_band: '彈力帶',
    treadmill: '跑步機',
  }[value] ?? value;
}
