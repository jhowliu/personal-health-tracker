import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { defaultExercisePrescription, ExerciseLibrary, type Exercise } from '@/components/ExerciseLibrary';
import { NumberStepper } from '@/components/NumberStepper';
import { ReorderList } from '@/components/ReorderList';
import { ChevronIcon, PlusIcon } from '@/components/icons';
import { Text } from '@/components/text';
import {
  BackLink,
  Card,
  Field,
  Hint,
  PrimaryButton,
  Screen,
  Segmented,
  SectionHeading,
  TextAction,
  Title,
} from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';
import { backOrReplace } from '@/navigation/back';
import { replacement } from '@/workouts/replacement';

type Template = Schema<'TemplateOut'>;
type Draft = {
  /** Stable across moves; the saved id, or a made-up one for an exercise not saved yet. */
  key: string;
  id: string | null;
  exercise_id: string;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  weight_kg: number | null;
  rest_sec: number;
  note: string | null;
};

let unsavedKeys = 0;
const newKey = () => `new-${++unsavedKeys}`;

export default function EditTemplate() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const [allowLeave, setAllowLeave] = useState(false);

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [items, setItems] = useState<Draft[]>([]);
  const [isBuiltin, setIsBuiltin] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    if (!id) {
      backOrReplace('/workouts');
      return;
    }
    (async () => {
      try {
        if (isNew) {
          if (!live) return;
          setName('');
          setDuration('');
          setItems([]);
          setIsBuiltin(false);
          setBaseline(serialiseTemplate('', '', []));
          setLoadedId(id);
        } else {
          const template: Template = await api.get(`/workout-templates/${id}`);
          if (!live) return;
          setName(template.name);
          setDuration(template.duration_min ? String(template.duration_min) : '');
          setIsBuiltin(template.is_builtin);
          const loadedItems = template.items.map((item) => ({ ...item, key: item.id }));
          setItems(loadedItems);
          setBaseline(serialiseTemplate(
            template.name,
            template.duration_min ? String(template.duration_min) : '',
            loadedItems,
          ));
          setLoadedId(id);
        }
      } catch (error) {
        Alert.alert(t('workouts.editor.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'), [
          { text: t('workouts.editor.returnToWorkouts'), onPress: () => backOrReplace('/workouts') },
        ]);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, isNew, t]);

  const ready = loadedId === id;
  const dirty = ready && baseline !== serialiseTemplate(name, duration, items);

  useEffect(() => {
    if (!ready) return;
    const consumeReplacement = () => {
      const selected = replacement.take(id);
      if (!selected) return;
      setItems((current) =>
        current.map((item, index) =>
          index === selected.index
            ? { ...item, exercise_id: selected.exercise_id, exercise_name: selected.exercise_name }
            : item,
        ),
      );
    };
    consumeReplacement();
    return replacement.subscribe(consumeReplacement);
  }, [id, ready]);

  usePreventRemove(dirty && !allowLeave, ({ data }) => {
    if (busy) return;
    Alert.alert(t('workouts.editor.discardTitle'), t('workouts.editor.discardBody'), [
      { text: t('workouts.editor.continueEditing'), style: 'cancel' },
      {
        text: t('common.actions.discard'),
        style: 'destructive',
        onPress: () => {
          setAllowLeave(true);
          requestAnimationFrame(() => navigation.dispatch(data.action));
        },
      },
    ]);
  });

  // While a row is dragged the page holds still under the finger.
  const [dragging, setDragging] = useState(false);

  const patch = (index: number, changes: Partial<Draft>) =>
    setItems(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  const addFromLibrary = (exercise: Exercise) => {
    const defaults = defaultExercisePrescription(exercise.category_id);
    setItems([
      ...items,
      {
        key: newKey(),
        id: null,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        ...defaults,
        note: null,
      },
    ]);
    // The library stays open with its filters, for the next exercise; the new one is set up
    // with the defaults and opened for changes only when tapped.
  };

  const save = async () => {
    setBusy(true);
    const body = {
      category_id: 'strength',
      name,
      duration_min: duration ? Number(duration) : null,
      items: items.map((item) => ({
        id: item.id,
        exercise_id: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        duration_sec: item.duration_sec,
        weight_kg: item.weight_kg,
        rest_sec: item.rest_sec,
        note: item.note,
      })),
    };
    try {
      if (isNew) await api.post('/workout-templates', body);
      else await api.put(`/workout-templates/${id}`, body);
      setAllowLeave(true);
      requestAnimationFrame(() => backOrReplace('/workouts'));
    } catch (error) {
      Alert.alert(t('common.errors.saveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setBusy(true);
    try {
      const copied: Template = await api.post(`/workout-templates/${id}/copy`);
      setAllowLeave(true);
      requestAnimationFrame(() => router.replace(`/workouts/${copied.id}`));
    } catch (error) {
      Alert.alert(t('workouts.editor.copyFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scrollEnabled={!dragging}
      footer={
        isBuiltin ? (
          <PrimaryButton onPress={copy} busy={busy}>
            {busy ? t('common.states.copying') : t('workouts.editor.copyCustomize')}
          </PrimaryButton>
        ) : (
          <View className="flex-row items-center gap-3">
            <Text className="text-sm text-muted">
              {t(items.length === 1 ? 'common.counts.exercises.one' : 'common.counts.exercises.other', { count: items.length })}
            </Text>
            <View className="flex-1">
              <PrimaryButton
                onPress={save}
                disabled={!name || items.length === 0}
                busy={busy}
              >
                {busy ? t('common.states.saving') : t('workouts.editor.saveTemplate')}
              </PrimaryButton>
            </View>
          </View>
        )
      }
    >
      <BackLink label={t('workouts.home.title')} onPress={() => backOrReplace('/workouts')} disabled={busy} />

      <Title>{isNew ? t('workouts.editor.newTitle') : isBuiltin ? t('workouts.editor.publicTitle') : t('workouts.editor.editTitle')}</Title>

      {isBuiltin ? <Hint>{t('workouts.editor.publicHint')}</Hint> : null}

      <Field
        label={t('workouts.editor.templateName')}
        value={name}
        onChangeText={setName}
        placeholder={t('workouts.editor.templateNamePlaceholder')}
        editable={!isBuiltin}
      />

      <Field
        label={t('workouts.editor.approximateTime')}
        suffix={t('common.units.minute')}
        value={duration}
        onChangeText={setDuration}
        keyboardType="numeric"
        editable={!isBuiltin}
      />
      <Hint>{t('workouts.editor.locationHint')}</Hint>

      <SectionHeading action={<Text className="text-sm text-muted">{items.length}</Text>}>
        {t('workouts.editor.exercises')}
      </SectionHeading>

      <ReorderList
        items={items}
        keyOf={(item) => item.key}
        divided={false}
        disabled={isBuiltin}
        estimatedHeight={86}
        onDragChange={(active) => {
          setDragging(active);
          // Rows are dragged closed, so every one is the same short card.
          if (active) setEditing(null);
        }}
        onReorder={(keys) =>
          setItems(keys.flatMap((key) => items.filter((item) => item.key === key)))
        }
        renderRow={(item, handle) => {
          const index = items.indexOf(item);
          return (
            <View className="pb-3">
              {editing === index ? (
                <Card className="gap-3 border-primary">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base text-ink">
                      {index + 1}. {item.exercise_name}
                    </Text>
                    <TextAction
                      tone="danger"
                      label={t('common.actions.remove')}
                      onPress={() => {
                        setItems(items.filter((_, i) => i !== index));
                        setEditing(null);
                      }}
                    />
                  </View>

                  <Segmented
                    value={item.duration_sec === null ? 'reps' : 'time'}
                    onChange={(mode) =>
                      patch(
                        index,
                        mode === 'time'
                          ? { duration_sec: item.duration_sec ?? 1200, reps: null, sets: null }
                          : { duration_sec: null, reps: item.reps ?? '10-12', sets: item.sets ?? 3 },
                      )
                    }
                    options={[
                      { value: 'reps', label: t('workouts.editor.repsMode') },
                      { value: 'time', label: t('workouts.editor.timeMode') },
                    ]}
                  />

                  {item.duration_sec === null ? (
                    <View className="flex-row items-end gap-3">
                      <View className="gap-1">
                        <Text className="text-sm text-muted">{t('common.labels.sets')}</Text>
                        <NumberStepper
                          value={item.sets ?? 1}
                          onChange={(sets) => patch(index, { sets })}
                        />
                      </View>
                      <Field
                        label={t('common.labels.reps')}
                        value={item.reps ?? ''}
                        onChangeText={(reps) => patch(index, { reps })}
                        placeholder="10-12"
                      />
                      <Field
                        label={t('common.labels.weight')}
                        suffix="kg"
                        value={item.weight_kg === null ? '' : String(item.weight_kg)}
                        onChangeText={(text) => patch(index, { weight_kg: text ? Number(text) : null })}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : (
                    <Field
                      label={t('common.labels.time')}
                      suffix={t('common.units.minute')}
                      value={String(Math.round(item.duration_sec / 60))}
                      onChangeText={(text) =>
                        patch(index, { duration_sec: Math.max(1, Number(text) || 1) * 60 })
                      }
                      keyboardType="numeric"
                    />
                  )}

                  <Field
                    label={t('common.labels.notes')}
                    value={item.note ?? ''}
                    onChangeText={(note) => patch(index, { note: note || null })}
                    placeholder={t('workouts.editor.notePlaceholder')}
                  />

                  <Field
                    label={t('common.labels.rest')}
                    value={String(item.rest_sec)}
                    onChangeText={(text) => patch(index, { rest_sec: Number(text) || 0 })}
                    suffix={t('common.units.second')}
                    keyboardType="numeric"
                  />

                  <TextAction
                    label={t('workouts.editor.findAlternative')}
                    onPress={() =>
                      router.navigate(
                        `/workouts/alternatives?template_id=${id}&exercise_id=${item.exercise_id}&item_index=${index}&name=${encodeURIComponent(item.exercise_name)}`,
                      )
                    }
                  />

                  <TextAction tone="muted" label={t('common.actions.collapse')} onPress={() => setEditing(null)} className="justify-center" />
                </Card>
              ) : (
                // The handle sits beside the row's button, not inside it: a button in a button
                // is invalid on web and steals the handle's touches.
                <View
                  className={`min-h-[44px] flex-row items-center gap-1 rounded-tile border-[1.5px] border-edge bg-surface py-3 pr-3 ${
                    handle ? 'pl-1' : 'pl-3'
                  }`}
                >
                  {handle}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.accessibility.editNamed', { name: item.exercise_name })}
                    disabled={isBuiltin}
                    onPress={() => setEditing(index)}
                    className="min-h-[44px] flex-1 justify-center gap-0.5"
                  >
                    <Text className="text-base text-ink">
                      {index + 1}. {item.exercise_name}
                    </Text>
                    <Text className="text-sm text-muted">
                      {item.duration_sec
                        ? t('workouts.editor.durationSummary', { minutes: Math.round(item.duration_sec / 60) })
                        : item.sets
                          ? t('workouts.editor.setsRepsSummary', { sets: item.sets, reps: item.reps ?? '' })
                          : item.reps}
                      {item.weight_kg ? `,${item.weight_kg} kg` : ''}
                    </Text>
                  </Pressable>
                  {isBuiltin ? null : <ChevronIcon direction="right" size={15} tint={color.ink} />}
                </View>
              )}
            </View>
          );
        }}
      />

      {items.length === 0 ? <Hint>{t('workouts.editor.noExercises')}</Hint> : null}

      {isBuiltin ? null : (
        <>
          <PrimaryButton
            tone="plain"
            icon={libraryOpen ? undefined : PlusIcon}
            onPress={() => setLibraryOpen((open) => !open)}
          >
            {libraryOpen ? t('workouts.editor.closeLibrary') : t('workouts.editor.openLibrary')}
          </PrimaryButton>

          {libraryOpen ? (
            <ExerciseLibrary
              onSelect={addFromLibrary}
              addedIds={new Set(items.map((item) => item.exercise_id))}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function serialiseTemplate(name: string, duration: string, items: Draft[]) {
  return JSON.stringify({ name, duration, items });
}
