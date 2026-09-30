import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { CheckIcon, ChevronIcon, PlusIcon } from '@/components/icons';
import { ShowMore, usePaged } from '@/components/paging';
import { Sheet } from '@/components/Sheet';
import { Chip, Field, Hint, PrimaryButton, Tag } from '@/components/ui';
import { color } from '@/theme/tokens';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';

export type Exercise = Schema<'ExerciseOut'>;


export function ExerciseLibrary({
  onSelect,
  selectLabel = '加入',
  addedIds,
}: {
  onSelect: (exercise: Exercise) => void;
  selectLabel?: string;
  /** Exercises that are already in place: their card turns green and cannot be added again. */
  addedIds?: ReadonlySet<string>;
}) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [bodyRegion, setBodyRegion] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [previewing, setPreviewing] = useState<Exercise | null>(null);
  const loadVersion = useRef(0);
  // The whole catalogue comes back in one response; only a page of rows is drawn at a time.
  const { visible, remaining, showMore } = usePaged(exercises, exercises);

  useEffect(() => {
    const version = ++loadVersion.current;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category !== 'all') params.set('category_id', category);
        if (bodyRegion !== 'all') params.set('body_region', bodyRegion);
        if (equipment !== 'all') params.set('equipment', equipment);
        const suffix = params.size ? `?${params}` : '';
        const result = await api.get(`/exercises${suffix}`);
        if (version === loadVersion.current) setExercises(result);
      } catch (error) {
        if (version === loadVersion.current) {
          Alert.alert('讀不到動作庫', error instanceof ApiError ? error.message : '請稍後再試');
        }
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [bodyRegion, category, equipment, query]);

  return (
    <View className="gap-3">
      <Field value={query} onChangeText={setQuery} placeholder="搜尋動作名稱" />
      {/* One line each, swiped sideways: three wrapped rows of chips pushed the list off the screen. */}
      <View className="-mx-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {['all', 'strength', 'cardio', 'mobility'].map((value) => (
            <Chip key={value} label={categoryLabel(value)} selected={category === value} onPress={() => setCategory(value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {['all', 'upper_body', 'lower_body', 'core', 'full_body', 'mobility'].map((value) => (
            <Chip key={value} label={bodyLabel(value)} selected={bodyRegion === value} onPress={() => setBodyRegion(value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {['all', 'bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'resistance_band', 'treadmill'].map((value) => (
            <Chip key={value} label={equipmentLabel(value)} selected={equipment === value} onPress={() => setEquipment(value)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={color.primary} />
      ) : exercises.length === 0 ? (
        <Hint>找不到符合的動作，請調整搜尋或篩選。</Hint>
      ) : (
        <View className="gap-2">
          <Hint>共 {exercises.length} 個動作</Hint>
          {visible.map((exercise) => (
            // The thumbnail and 查看動作 preview, the button adds; three sibling targets, since a
            // button inside a button is invalid on web.
            <View
              key={exercise.id}
              className={`flex-row gap-3 rounded-card border p-3 ${
                addedIds?.has(exercise.id) ? 'border-good bg-good-soft/40' : 'border-line bg-surface'
              }`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`查看${exercise.name}的動作示範`}
                onPress={() => setPreviewing(exercise)}
                className="self-start"
              >
                <ExerciseFigure exerciseId={exercise.id} name={exercise.name} mode="single" size={88} />
              </Pressable>
              <View className="min-w-0 flex-1 gap-2">
                <Text className="text-base font-semibold text-ink">{exercise.name}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {[categoryLabel(exercise.category_id), bodyLabel(exercise.body_region), equipmentLabel(exercise.equipment)]
                    .filter(Boolean)
                    .map((label) => (
                      <Tag key={label} label={label} />
                    ))}
                </View>
                {exercise.description ? (
                  <Text className="text-sm text-muted" numberOfLines={2}>
                    {exercise.description}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`查看${exercise.name}的動作示範`}
                    onPress={() => setPreviewing(exercise)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    className="flex-row items-center gap-0.5"
                  >
                    <Text className="text-sm font-semibold text-primary">查看動作</Text>
                    <ChevronIcon direction="right" size={16} tint={color.primary} />
                  </Pressable>
                  {addedIds?.has(exercise.id) ? (
                    <View
                      accessibilityRole="text"
                      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-good-soft px-4"
                    >
                      <CheckIcon size={16} tint={color.good} />
                      <Text className="text-sm font-semibold text-good">已加入</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onSelect(exercise)}
                      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-4 active:opacity-80"
                    >
                      <PlusIcon size={16} tint={color.surface} />
                      <Text className="text-sm font-semibold text-white">{selectLabel}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          ))}
          <ShowMore remaining={remaining} onPress={showMore} />
        </View>
      )}

      <Sheet visible={previewing !== null} title={previewing?.name ?? '動作'} onClose={() => setPreviewing(null)}>
        {previewing ? (
          <>
            <ExerciseFigure exerciseId={previewing.id} name={previewing.name} mode="pair" />
            {previewing.description ? <Hint>{previewing.description}</Hint> : null}
            {addedIds?.has(previewing.id) ? (
              <PrimaryButton tone="plain" icon={CheckIcon} disabled>
                已加入
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onPress={() => {
                  const chosen = previewing;
                  setPreviewing(null);
                  onSelect(chosen);
                }}
              >
                {selectLabel}
              </PrimaryButton>
            )}
          </>
        ) : null}
      </Sheet>
    </View>
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
