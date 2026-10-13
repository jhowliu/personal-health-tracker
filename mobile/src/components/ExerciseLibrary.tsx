import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { CheckIcon, ChevronIcon, PlusIcon } from '@/components/icons';
import { ShowMore, usePaged } from '@/components/paging';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/text';
import { Chip, Field, Hint, PrimaryButton, Tag } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { color } from '@/theme/tokens';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';

export type Exercise = Schema<'ExerciseOut'>;


export function ExerciseLibrary({
  onSelect,
  selectLabel,
  addedIds,
}: {
  onSelect: (exercise: Exercise) => void;
  selectLabel?: string;
  /** Exercises that are already in place: their card turns green and cannot be added again. */
  addedIds?: ReadonlySet<string>;
}) {
  const { t } = useI18n();
  const effectiveSelectLabel = selectLabel ?? t('common.actions.add');
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
          Alert.alert(t('workouts.library.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
        }
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [bodyRegion, category, equipment, query, t]);

  return (
    <View className="gap-3">
      <Field value={query} onChangeText={setQuery} placeholder={t('workouts.library.searchPlaceholder')} />
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
          {['all', 'bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'machine', 'cable', 'resistance_band', 'treadmill'].map((value) => (
            <Chip key={value} label={equipmentLabel(value)} selected={equipment === value} onPress={() => setEquipment(value)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={color.primary} />
      ) : exercises.length === 0 ? (
        <Hint>{t('workouts.library.noResults')}</Hint>
      ) : (
        <View className="gap-2">
          <Hint>{t('workouts.library.resultCount', { count: exercises.length })}</Hint>
          {visible.map((exercise) => (
            // The thumbnail and 查看動作 preview, the button adds; three sibling targets, since a
            // button inside a button is invalid on web.
            <View
              key={exercise.id}
              className={`flex-row gap-3 rounded-tile border-[1.5px] p-3 ${
                addedIds?.has(exercise.id) ? 'border-good bg-good-soft' : 'border-edge bg-surface'
              }`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('workouts.library.viewDemo', { name: exercise.name })}
                onPress={() => setPreviewing(exercise)}
                className="self-start"
              >
                <ExerciseFigure exerciseId={exercise.id} name={exercise.name} mode="single" size={88} />
              </Pressable>
              <View className="min-w-0 flex-1 gap-2">
                <Text className="text-base text-ink">{exercise.name}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {/* A mobility exercise is 活動度 by category and by body region; show it once. */}
                  {[
                    ...new Set(
                      [categoryLabel(exercise.category_id), bodyLabel(exercise.body_region), equipmentLabel(exercise.equipment)].filter(Boolean),
                    ),
                  ].map((label) => (
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
                    accessibilityLabel={t('workouts.library.viewDemo', { name: exercise.name })}
                    onPress={() => setPreviewing(exercise)}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    className="flex-row items-center gap-0.5"
                  >
                    <Text className="text-sm text-primary">{t('workouts.library.viewExercise')}</Text>
                    <ChevronIcon direction="right" size={16} tint={color.primary} />
                  </Pressable>
                  {addedIds?.has(exercise.id) ? (
                    <View
                      accessibilityRole="text"
                      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-control px-3"
                    >
                      <CheckIcon size={16} tint={color.good} />
                      <Text className="text-sm text-good">{t('common.states.added')}</Text>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onSelect(exercise)}
                      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-control border-[1.5px] border-edge bg-primary px-4 active:opacity-80"
                    >
                      <PlusIcon size={16} tint={color.surface} />
                      <Text className="text-sm text-white">{effectiveSelectLabel}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          ))}
          <ShowMore remaining={remaining} onPress={showMore} />
        </View>
      )}

      <Sheet visible={previewing !== null} title={previewing?.name ?? t('workouts.library.exerciseFallback')} onClose={() => setPreviewing(null)}>
        {previewing ? (
          <>
            <ExerciseFigure exerciseId={previewing.id} name={previewing.name} mode="pair" />
            {previewing.description ? <Hint>{previewing.description}</Hint> : null}
            {addedIds?.has(previewing.id) ? (
              <PrimaryButton tone="plain" icon={CheckIcon} disabled>
                {t('common.states.added')}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onPress={() => {
                  const chosen = previewing;
                  setPreviewing(null);
                  onSelect(chosen);
                }}
              >
                {effectiveSelectLabel}
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
  return {
    all: translate('workouts.library.categoryAll'),
    strength: translate('workouts.library.categoryStrength'),
    cardio: translate('workouts.library.categoryCardio'),
    mobility: translate('workouts.library.categoryMobility'),
  }[value] ?? value;
}

function bodyLabel(value: string | null) {
  if (!value || value === 'all') return value === 'all' ? translate('workouts.library.bodyAll') : '';
  return {
    upper_body: translate('workouts.library.upperBody'),
    lower_body: translate('workouts.library.lowerBody'),
    core: translate('workouts.library.core'),
    full_body: translate('workouts.library.fullBody'),
    mobility: translate('workouts.library.categoryMobility'),
  }[value] ?? value;
}

function equipmentLabel(value: string | null) {
  if (!value || value === 'all') return value === 'all' ? translate('workouts.library.equipmentAll') : '';
  return {
    bodyweight: translate('workouts.library.bodyweight'),
    dumbbell: translate('workouts.library.dumbbell'),
    barbell: translate('workouts.library.barbell'),
    kettlebell: translate('workouts.library.kettlebell'),
    machine: translate('workouts.library.machine'),
    cable: translate('workouts.library.cable'),
    resistance_band: translate('workouts.library.resistanceBand'),
    treadmill: translate('workouts.library.treadmill'),
  }[value] ?? value;
}
