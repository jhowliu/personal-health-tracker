/**
 * Focus mode: the phone as the panel for the set at hand (docs/focus-mode-spec.md).
 *
 * One screen, two looks: working (beige, big set number, one button per set) and resting
 * (soft plum, a shrinking ring). Sets go to the server the moment they are done; the
 * session's own state — clock, rest, steppers — is saved on the phone after every change,
 * so leaving, being killed or losing the screen never loses work. Today only.
 */
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { CheckNumber, Highlight, Paper } from '@/components/journal';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/text';
import { Chip, Hint, PrimaryButton } from '@/components/ui';
import { todayISO } from '@/dates';
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { color } from '@/theme/tokens';
import { RestRing, Segments, SetDots, Stepper, clock, kg, tabular } from '@/workouts/focus/parts';
import { buzz, cancelRestAlarm, ensureRestAlarmPermission, scheduleRestAlarm } from '@/workouts/focus/rest-alarm';
import {
  REST_STEP_SEC,
  adjustRest,
  awaitingFeedback,
  completeCurrent,
  currentWarmup,
  finishedWarmups,
  elapsedMs,
  fromWorkout,
  isDone,
  isFinished,
  jumpTo,
  pause,
  restLeftSec,
  restore,
  resume,
  setFeedback,
  settleRest,
  skipRest,
  skipWarmup,
  step,
  summary,
  upNext,
  type Effort,
  type FocusExercise,
  type Session,
} from '@/workouts/focus/session';
import { clearSession, loadSession, saveSession } from '@/workouts/focus/storage';

type Workout = Schema<'WorkoutExecutionOut'>;

const EFFORTS: Effort[] = ['easy', 'appropriate', 'hard'];
/** A second tap within this window is the same tap, not a second set (spec §6). */
const DOUBLE_TAP_MS = 300;

export default function FocusWorkout() {
  const { t } = useI18n();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState(() => t('workouts.focus.todayWorkout'));
  const [phase, setPhase] = useState<'focus' | 'summary'>('focus');
  const [sheet, setSheet] = useState<'list' | 'exit' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [notifyHint, setNotifyHint] = useState(false);
  // The cardio timer is a stopwatch for the user's benefit; what is logged is the minutes.
  const [cardio, setCardio] = useState<{ since: number | null; spentMs: number }>({ since: null, spentMs: 0 });
  // The ticker and AppState listener outlive renders, so they read the latest values here.
  const live = useRef<Session | null>(null);
  const cardioRef = useRef(cardio);
  useEffect(() => {
    live.current = session;
    cardioRef.current = cardio;
  }, [session, cardio]);
  const lastTap = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  // Read on every visit, not just the first: coming back from 加入動作 or 換動作, the
  // workout has changed underneath, and the session in hand is merged onto it.
  const asked = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!date || date !== todayISO()) {
        router.back();
        return;
      }
      let active = true;
      (async () => {
        try {
          const workout = (await api.get(`/days/${date}/workout`)) as Workout;
          if (!active) return;
          setTitle(workout.template?.name ?? t('workouts.focus.todayWorkout'));
          const at = Date.now();
          const fresh = fromWorkout(workout, at);
          const base = live.current ?? (await loadSession(date));
          const started = settleRest(base ? resume(restore(base, fresh), at) : fresh, at);
          setSession(started);
          if (isFinished(started)) setPhase('summary');
          if (!asked.current) {
            asked.current = true;
            if (!(await ensureRestAlarmPermission())) setNotifyHint(true);
          }
        } catch (error) {
          Alert.alert(t('workouts.focus.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
          router.back();
        }
      })();
      return () => {
        active = false;
      };
    }, [date, t]),
  );

  // Leaving the screen by any way out — the back gesture, Android's back button, the browser's
  // back — counts as 暫停並離開, so a forgotten session does not keep its clock running. This
  // runs on unmount rather than on beforeRemove, which a web history pop skips. Opening 加入動作
  // or 換動作 keeps this screen mounted underneath and does not pause. Once saved, nothing is left.
  const saved = useRef(false);
  useEffect(
    () => () => {
      const current = live.current;
      if (!current || saved.current) return;
      void cancelRestAlarm(current.date);
      void saveSession(pause(current, Date.now()));
    },
    [],
  );

  // Saved after every change: a killed app reopens to 繼續訓練 with everything in place.
  useEffect(() => {
    if (session) void saveSession(session);
  }, [session]);

  // The clock only redraws; the truth is in the end times (spec §5).
  useEffect(() => {
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      const current = live.current;
      if (current?.rest && at >= current.rest.endsAt) {
        setSession(settleRest(current, at));
        void cancelRestAlarm(current.date);
        buzz();
        showToast(t('workouts.focus.restFinishedToast'));
      }
      const timer = cardioRef.current;
      const exercise = current?.exercises[current.currentIndex];
      if (timer.since !== null && exercise?.kind === 'time' && timer.spentMs + at - timer.since >= exercise.minutes * 60000) {
        setCardio({ since: null, spentMs: exercise.minutes * 60000 });
        buzz();
        showToast(t('workouts.focus.timeUpToast'));
      }
    }, 500);
    return () => clearInterval(id);
  }, [showToast, t]);

  // Back from the background: the notification already told them, so just catch up quietly.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const at = Date.now();
      setNow(at);
      const current = live.current;
      if (current?.rest && at >= current.rest.endsAt) setSession(settleRest(current, at));
    });
    return () => subscription.remove();
  }, []);

  if (!session || !date) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={color.primary} />
      </SafeAreaView>
    );
  }

  const exercise = session.exercises[session.currentIndex];
  const resting = session.rest !== null;

  const putSet = (body: Record<string, unknown>) => api.put(`/days/${date}/workout/sets`, body);

  const restBody = (next: Session) => {
    const coming = next.exercises[next.currentIndex];
    if (next.rest?.nextIsNewExercise) return t('workouts.focus.nextExercise', { name: coming.name });
    const warm = currentWarmup(coming);
    return warm
      ? t('workouts.focus.warmupNext', { number: warm.number, weight: kg(warm.set.weightKg), reps: warm.set.reps })
      : t('workouts.focus.nextSet', { number: coming.logs.length + 1 });
  };

  const complete = async () => {
    const at = Date.now();
    if (busy || at - lastTap.current < DOUBLE_TAP_MS) return;
    lastTap.current = at;
    const { session: next, log, finished } = completeCurrent(session, at);
    // A warm-up set is only counted on the phone; a working set goes to the server first.
    if (log) {
      setBusy(true);
      try {
        await putSet({
          day_workout_item_id: log.itemId,
          exercise_id: log.exerciseId,
          set_index: log.setIndex,
          reps_done: log.reps,
          duration_sec: log.durationSec,
          weight_kg: log.weightKg,
          speed_kmh: log.speedKmh,
          incline_pct: log.inclinePct,
        });
      } catch (error) {
        Alert.alert(t('workouts.focus.setSaveFailed'), error instanceof ApiError ? error.message : t('workouts.focus.setSaveFailedBody'));
        return;
      } finally {
        setBusy(false);
      }
    }
    setCardio({ since: null, spentMs: 0 });
    if (finished) {
      // The clock stops at the last set; the summary shows the time that was trained.
      setSession(pause(next, at));
      setPhase('summary');
      return;
    }
    setSession(next);
    if (next.rest) void scheduleRestAlarm(date, next.rest.endsAt, restBody(next));
  };

  const nudgeRest = (deltaSec: number) => {
    const next = adjustRest(session, deltaSec, Date.now());
    setSession(next);
    if (next.rest) void scheduleRestAlarm(date, next.rest.endsAt, restBody(next));
    else void cancelRestAlarm(date);
  };

  const endRest = () => {
    void cancelRestAlarm(date);
    setSession(skipRest(session));
  };

  const endWarmup = () => {
    void cancelRestAlarm(date);
    setSession(skipWarmup(session));
  };

  // The sheet closes before navigating, so it is not still open on the way back.
  const openElsewhere = (path: Href) => {
    setSheet(null);
    requestAnimationFrame(() => router.navigate(path));
  };
  const replacePath = (target: FocusExercise): Href =>
    `/workouts/replace-today?date=${date}&item_id=${target.itemId}&exercise_id=${target.exerciseId}&name=${encodeURIComponent(target.name)}&from=focus`;

  const switchTo = (index: number) => {
    void cancelRestAlarm(date);
    setCardio({ since: null, spentMs: 0 });
    setSession(jumpTo(session, index));
    setSheet(null);
  };

  const giveFeedback = async (target: FocusExercise, effort: Effort) => {
    const lastIndex = target.logs.length - 1;
    const last = target.logs[lastIndex];
    if (!last) return;
    try {
      // The exercise's feeling rides on its last set, where the next session reads it.
      await putSet({
        day_workout_item_id: target.itemId,
        exercise_id: target.exerciseId,
        set_index: lastIndex,
        reps_done: last.reps,
        weight_kg: last.weightKg,
        effort,
      });
      setSession((current) => (current ? setFeedback(current, target.itemId, effort) : current));
    } catch (error) {
      Alert.alert(t('workouts.focus.feedbackSaveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    }
  };

  // Store the pause before going, so today's screen reads 繼續訓練 straight away; the unmount
  // cleanup then finds the session already paused and changes nothing.
  const leave = async () => {
    const paused = pause(session, Date.now());
    live.current = paused;
    void cancelRestAlarm(date);
    await saveSession(paused);
    setSheet(null);
    router.back();
  };

  const finishEarly = () => {
    void cancelRestAlarm(date);
    setSession(pause(session, Date.now()));
    setSheet(null);
    setPhase('summary');
  };

  const save = async () => {
    setBusy(true);
    try {
      // The clocked time is what costs the counted sets, which carry no minutes of their own.
      const trainedSec = Math.round(elapsedMs(session, Date.now()) / 1000);
      await api.patch(`/days/${date}`, {
        workout_done: true,
        ...(trainedSec > 0 ? { trained_sec: Math.min(trainedSec, 6 * 3600) } : {}),
      });
      saved.current = true;
      await clearSession(date);
      router.back();
    } catch (error) {
      Alert.alert(t('workouts.focus.saveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'summary') {
    return (
      <Summary
        session={session}
        title={title}
        elapsedSec={elapsedMs(session, now) / 1000}
        busy={busy}
        onFeedback={giveFeedback}
        onSave={save}
      />
    );
  }

  const states = session.exercises.map((candidate, index) =>
    isDone(candidate) ? ('done' as const) : index === session.currentIndex ? ('current' as const) : ('todo' as const),
  );
  const setNumber = exercise.kind === 'sets' ? exercise.logs.length + 1 : 1;
  const warmup = currentWarmup(exercise);
  const warmedUp = finishedWarmups(exercise);
  const finalSet = !warmup && (exercise.kind === 'time' || exercise.logs.length === exercise.plannedSets - 1);
  const after = upNext(session);
  const lastOfDay = finalSet && after === -1;
  const finished = resting ? session.exercises.find((candidate) => candidate.itemId === session.rest?.finishedItemId) : undefined;
  const cardioLeftSec =
    (exercise.minutes * 60000 - (cardio.spentMs + (cardio.since !== null ? now - cardio.since : 0))) / 1000;
  const anyLogged = session.exercises.some((candidate) => candidate.logs.length > 0 || candidate.timeDone);

  return (
    <SafeAreaView edges={['top', 'bottom']} className={`flex-1 ${resting ? 'bg-primary-soft' : 'bg-bg'}`}>
      <Paper />
      <View className="flex-row items-center justify-between px-3.5 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workouts.focus.leaveAccessibility')}
          onPress={() => setSheet('exit')}
          className="h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-edge bg-surface"
        >
          <CloseIcon size={20} tint={color.ink} />
        </Pressable>
        <View className="items-center">
          <Text className="text-xs text-muted">{t('workouts.focus.workoutTime')}</Text>
          <Text className="text-xl text-ink" style={tabular}>
            {clock(elapsedMs(session, now) / 1000)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workouts.focus.exerciseListAccessibility', {
            current: session.currentIndex + 1,
            total: session.exercises.length,
          })}
          onPress={() => setSheet('list')}
          className="h-[46px] flex-row items-center rounded-full border-2 border-edge bg-surface px-3.5"
        >
          <Text className="text-[15px] text-ink" style={tabular}>
            {session.currentIndex + 1} / {session.exercises.length}
          </Text>
        </Pressable>
      </View>

      <View className="px-[18px] pt-3">
        <Segments states={states} resting={resting} />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-1 px-[18px] pb-4 pt-3">
        {notifyHint ? (
          <Pressable onPress={() => setNotifyHint(false)} className="mb-2 rounded-card bg-warm-soft p-3">
            <Text className="text-sm text-warm">{t('workouts.focus.notificationHint')}</Text>
          </Pressable>
        ) : null}
        {resting ? (
          <Text className="text-sm text-primary">
            {session.rest?.nextIsNewExercise
              ? t('workouts.focus.nextExerciseLabel')
              : warmup
                ? t('workouts.focus.nextWarmup', { current: warmup.number, total: warmup.total })
                : t('workouts.focus.nextWorkingSet', { current: setNumber, total: exercise.plannedSets })}
          </Text>
        ) : null}
        <Text className="text-[30px] leading-tight text-ink">{exercise.name}</Text>
        <Text className="text-[15px] text-muted">
          {exercise.kind === 'time'
            ? t('workouts.focus.targetMinutes', { minutes: exercise.targetMin })
            : t('workouts.focus.targetSets', {
                sets: exercise.plannedSets,
                reps: exercise.repsLabel ? t('workouts.focus.repSuffix', { reps: exercise.repsLabel }) : '',
              })}
        </Text>

        {resting && session.rest ? (
          <View className="py-3">
            <RestRing leftSec={restLeftSec(session, now)} totalSec={session.rest.totalSec} />
          </View>
        ) : exercise.kind === 'time' ? (
          <View className="items-center gap-2 py-3">
            <Text className="text-[76px] font-extrabold text-ink" style={tabular}>
              {clock(cardioLeftSec)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setCardio((timer) =>
                  timer.since === null
                    ? { ...timer, since: Date.now() }
                    : { since: null, spentMs: timer.spentMs + Date.now() - timer.since },
                )
              }
              className="h-[50px] justify-center rounded-button border-2 border-edge bg-surface px-5"
            >
              <Text className="text-base text-ink">
                {cardio.since !== null
                  ? t('workouts.focus.pause')
                  : cardio.spentMs > 0
                    ? t('workouts.focus.resumeTimer')
                    : t('workouts.focus.startTimer')}
              </Text>
            </Pressable>
          </View>
        ) : warmup ? (
          // Warm-up sets are fixed by the working weight below; only the working set has steppers.
          <View className="gap-0.5 pb-1.5 pt-4">
            <View className="flex-row items-baseline gap-1.5">
              <Text className="text-[52px] font-extrabold text-warm" style={tabular}>
                {t('workouts.focus.warmup', { number: warmup.number })}
              </Text>
              <Text className="text-[17px] text-muted">{t('workouts.focus.setCounter', { total: warmup.total })}</Text>
            </View>
            <Text className="text-[26px] text-ink" style={tabular}>
              {t('workouts.focus.weightReps', { weight: kg(warmup.set.weightKg), reps: warmup.set.reps })}
            </Text>
            <Text className="text-[13px] text-muted">
              {t('workouts.focus.warmupExplanation', { weight: kg(exercise.weightKg ?? 0) })}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-between pb-1.5 pt-4">
            <View className="flex-row items-baseline gap-1.5">
              <Text className="text-[52px] font-extrabold text-primary" style={tabular}>
                {t('workouts.focus.setNumber', { number: setNumber })}
              </Text>
              <Text className="text-[17px] text-muted">{t('workouts.focus.setCounter', { total: exercise.plannedSets })}</Text>
            </View>
            <SetDots done={exercise.logs.length} total={exercise.plannedSets} />
          </View>
        )}

        {finished ? <FeedbackAsk exercise={finished} onPick={giveFeedback} /> : null}

        <Text className="mt-2 text-[13px] text-muted">{carriedNote(exercise)}</Text>
        {exercise.kind === 'time' ? (
          <>
            <Stepper
              label={t('common.labels.actualTime')}
              value={String(exercise.minutes)}
              unit={t('common.units.minute')}
              onStep={(direction) => setSession(step(session, 'minutes', direction))}
            />
            {exercise.treadmill ? (
              <>
                <Stepper
                  label={t('common.labels.speed')}
                  value={exercise.speedKmh === null ? '—' : kg(exercise.speedKmh)}
                  unit="km/h"
                  onStep={(direction) => setSession(step(session, 'speed', direction))}
                />
                <Stepper
                  label={t('common.labels.incline')}
                  value={exercise.inclinePct === null ? '—' : kg(exercise.inclinePct)}
                  unit="%"
                  onStep={(direction) => setSession(step(session, 'incline', direction))}
                />
                <Text className="text-[13px] text-muted">
                  {exercise.speedKmh === null
                    ? t('workouts.focus.cardioOptionalHint')
                    : t('workouts.focus.cardioHint')}
                </Text>
              </>
            ) : null}
          </>
        ) : (
          <>
            {exercise.weightKg !== null ? (
              <Stepper
                label={warmup ? t('workouts.focus.workingWeight') : t('common.labels.weight')}
                value={kg(exercise.weightKg)}
                unit="kg"
                onStep={(direction) => setSession(step(session, 'weight', direction))}
              />
            ) : null}
            <Stepper
              label={warmup ? t('workouts.focus.workingReps') : t('common.labels.reps')}
              value={String(exercise.reps)}
              unit={t('common.units.rep')}
              onStep={(direction) => setSession(step(session, 'reps', direction))}
            />
          </>
        )}

        {warmedUp.length ? (
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {warmedUp.map((set, index) => (
              <View key={index} className="rounded-full bg-warm-soft px-2.5 py-1.5">
                <Text className="text-[13px] text-warm" style={tabular}>
                  {t('workouts.focus.completedWarmup', { weight: kg(set.weightKg), reps: set.reps })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {exercise.kind === 'sets' && exercise.logs.length ? (
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {exercise.logs.map((log, index) => (
              <View key={index} className="rounded-full bg-good-soft px-2.5 py-1.5">
                <Text className="text-[13px] text-good" style={tabular}>
                  {t('workouts.focus.completedSet', {
                    number: index + 1,
                    result: log.weightKg !== null ? `${kg(log.weightKg)} × ${log.reps}` : `× ${log.reps}`,
                  })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="gap-2 px-[18px] pb-2 pt-2">
        {resting ? (
          <View className="flex-row gap-2.5">
            <DockButton label={t('workouts.focus.decreaseRest', { seconds: REST_STEP_SEC })} onPress={() => nudgeRest(-REST_STEP_SEC)} />
            <DockButton label={t('workouts.focus.increaseRest', { seconds: REST_STEP_SEC })} onPress={() => nudgeRest(REST_STEP_SEC)} />
            <Pressable
              accessibilityRole="button"
              onPress={endRest}
              className="h-16 flex-1 items-center justify-center rounded-[18px] border-2 border-primary bg-surface/60"
            >
              <Text className="text-[17px] text-primary">{t('workouts.focus.skipRest')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {finalSet ? (
              <Text className="text-center text-[13px] text-muted">
                {after !== -1
                  ? t('workouts.focus.afterSetNextExercise', {
                      action: t(exercise.kind === 'time' ? 'workouts.focus.finishExercise' : 'workouts.focus.finishSet'),
                      name: session.exercises[after].name,
                    })
                  : exercise.kind === 'time'
                    ? t('workouts.focus.lastExercise')
                    : t('workouts.focus.lastSet')}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={complete}
              className={`h-16 items-center justify-center rounded-[18px] bg-primary ${busy ? 'opacity-60' : ''}`}
            >
              <Text className="text-[19px] text-white">
                {busy
                  ? t('common.states.recording')
                  : warmup
                    ? t('workouts.focus.finishWarmup', { number: warmup.number })
                    : exercise.kind === 'time'
                      ? t('workouts.focus.finishThisExercise')
                      : lastOfDay
                        ? t('workouts.focus.finishLastSet')
                        : t('workouts.focus.finishSetNumber', { number: setNumber })}
              </Text>
            </Pressable>
            {warmup ? (
              <Pressable
                accessibilityRole="button"
                onPress={endWarmup}
                className="min-h-[44px] items-center justify-center"
              >
                <Text className="text-base text-primary">{t('workouts.focus.skipWarmup')}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {toast ? (
        <View pointerEvents="none" className="absolute bottom-32 self-center rounded-full bg-ink px-4 py-2.5">
          <Text className="text-sm text-white">{toast}</Text>
        </View>
      ) : null}

      <Sheet visible={sheet === 'list'} title={t('workouts.focus.exerciseListTitle')} onClose={() => setSheet(null)}>
        <Hint>{t('workouts.focus.occupiedHint')}</Hint>
        {session.exercises.map((candidate, index) => {
          const done = isDone(candidate);
          const current = index === session.currentIndex;
          const status = done
            ? t('workouts.item.completed')
            : current
              ? t('common.states.current')
              : candidate.logs.length
                ? t('workouts.item.setProgress', { done: candidate.logs.length, total: candidate.plannedSets })
                : t('common.states.notStarted');
          // Only an exercise not yet started can be swapped, so its sets never mix two exercises.
          const swappable = !done && candidate.logs.length === 0;
          return (
            <View
              key={candidate.itemId}
              className={`min-h-14 flex-row items-center gap-2 rounded-[14px] pl-3.5 pr-2 ${
                done ? 'bg-good-soft' : current ? 'border-2 border-primary bg-primary-soft' : 'bg-fill'
              }`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('workouts.focus.changeToNamed', { name: candidate.name })}
                disabled={done || current}
                onPress={() => switchTo(index)}
                className="min-h-14 flex-1 flex-row items-center justify-between gap-2.5"
              >
                <CheckNumber number={index + 1} done={done} current={current} />
                <Text className="flex-1 text-base text-ink">{candidate.name}</Text>
                <Text
                  className={`text-sm ${done ? 'text-good' : current ? 'text-primary' : 'text-muted'}`}
                >
                  {status}
                </Text>
              </Pressable>
              {swappable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.focus.replaceNamed', { name: candidate.name })}
                  onPress={() => openElsewhere(replacePath(candidate))}
                  className="min-h-[36px] justify-center rounded-full border border-primary bg-surface px-3"
                >
                  <Text className="text-sm text-primary">{t('workouts.item.changeExercise')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <PrimaryButton tone="plain" icon={PlusIcon} onPress={() => openElsewhere(`/workouts/add-today?date=${date}&from=focus`)}>
          {t('workouts.addToday.title')}
        </PrimaryButton>
      </Sheet>

      <Sheet visible={sheet === 'exit'} title={t('workouts.focus.leaveTitle')} onClose={() => setSheet(null)}>
        <Hint>{t('workouts.focus.leaveBody')}</Hint>
        <PrimaryButton onPress={() => setSheet(null)}>{t('workouts.focus.continueWorkout')}</PrimaryButton>
        <PrimaryButton tone="plain" onPress={leave}>
          {t('workouts.focus.pauseAndLeave')}
        </PrimaryButton>
        {anyLogged ? (
          <Pressable accessibilityRole="button" onPress={finishEarly} className="min-h-[44px] items-center justify-center">
            <Text className="text-base text-primary">{t('workouts.focus.finishAndSave')}</Text>
          </Pressable>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

/** Where the stepper values came from: today's last set, an earlier day, or the plan. */
function carriedNote(exercise: FocusExercise) {
  if (exercise.kind === 'time') return translate('workouts.focus.prefillTime', { minutes: exercise.targetMin });
  if (exercise.logs.length) return translate('workouts.focus.prefillPreviousSet');
  const last = exercise.last;
  if (!last) return translate('workouts.focus.prefillPlan');
  const feeling = last.effort ? ` (${translate(`common.effort.${last.effort}`)})` : '';
  if (last.weightKg === null) {
    return translate('workouts.focus.prefillBodyweight', { reps: last.reps ?? '-', feeling });
  }
  const suggested =
    exercise.suggestedWeightKg !== null && exercise.suggestedWeightKg !== last.weightKg
      ? translate('workouts.focus.suggestedWeight', { weight: kg(exercise.suggestedWeightKg) })
      : '';
  return translate('workouts.focus.prefillWeighted', {
    weight: kg(last.weightKg),
    reps: last.reps ?? '-',
    feeling,
    suggestion: suggested,
  });
}

function DockButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-16 items-center justify-center rounded-button border-2 border-edge bg-surface px-4"
    >
      <Text className="text-base text-ink" style={tabular}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Asked once a whole exercise is done; optional, so the next set never waits on it. */
function FeedbackAsk({ exercise, onPick }: { exercise: FocusExercise; onPick: (exercise: FocusExercise, effort: Effort) => void }) {
  const { t } = useI18n();
  return (
    <View className="gap-2 rounded-tile border-[1.5px] border-edge bg-surface p-3">
      <Text className="text-sm text-ink">
        {t('workouts.focus.feedbackQuestion', { name: exercise.name })}
        {/* Only a weight has a next step to suggest; bodyweight work just keeps the note. */}
        {exercise.weightKg !== null ? ` ${t('workouts.focus.feedbackHint')}` : ''}
      </Text>
      <View className="flex-row gap-2">
        {EFFORTS.map((effort) => (
          <Chip
            key={effort}
            label={t(`common.effort.${effort}`)}
            selected={exercise.feedback === effort}
            onPress={() => onPick(exercise, effort)}
          />
        ))}
      </View>
    </View>
  );
}

function Summary({
  session,
  title,
  elapsedSec,
  busy,
  onFeedback,
  onSave,
}: {
  session: Session;
  title: string;
  elapsedSec: number;
  busy: boolean;
  onFeedback: (exercise: FocusExercise, effort: Effort) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const totals = summary(session);
  const asking = awaitingFeedback(session);
  // Keep a just-answered exercise on screen until save, so the chip shows what was picked.
  const [asked] = useState(() => new Set(asking.map((exercise) => exercise.itemId)));
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <Paper />
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-[18px] pb-6 pt-6">
        <View className="gap-1">
          <Highlight size="title" className="self-start">
            <Text className="text-[32px] font-extrabold text-ink">{t('workouts.focus.completeTitle')}</Text>
          </Highlight>
          <Text className="text-sm text-muted">
            {t('workouts.focus.completeSubtitle', { name: title, count: session.exercises.length })}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Stat value={clock(elapsedSec)} label={t('workouts.focus.workoutTime')} />
          <Stat value={String(totals.sets)} label={t('workouts.focus.completedSets')} />
          {/* Bodyweight and timed work lift nothing; a 0 kg total reads as a mistake. */}
          {totals.volumeKg > 0 ? (
            <Stat value={formatNumber(Math.round(totals.volumeKg))} label={t('workouts.focus.totalVolume')} />
          ) : null}
        </View>

        {session.exercises
          .filter((exercise) => asked.has(exercise.itemId))
          .map((exercise) => (
            <FeedbackAsk key={exercise.itemId} exercise={exercise} onPick={onFeedback} />
          ))}

        <View>
          {totals.exercises.map(({ exercise, newRecord }) => (
            <View key={exercise.itemId} className="border-b border-line py-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-base text-ink">{exercise.name}</Text>
                {newRecord ? (
                  <View className="rounded-full bg-primary-soft px-2.5 py-0.5">
                    <Text className="text-xs text-primary">{t('workouts.focus.personalRecord')}</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-0.5 text-[13px] text-muted" style={tabular}>
                {exercise.kind === 'time'
                  ? exercise.timeDone
                    ? [
                        `${exercise.minutes} ${t('common.units.minute')}`,
                        exercise.speedKmh !== null ? `${kg(exercise.speedKmh)} km/h` : null,
                        exercise.speedKmh !== null && exercise.inclinePct !== null
                          ? t('workouts.focus.inclineSummary', { value: kg(exercise.inclinePct) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : t('workouts.focus.incomplete')
                  : exercise.logs.length
                    ? exercise.logs
                        .map((log) => (log.weightKg !== null ? `${kg(log.weightKg)} × ${log.reps}` : `× ${log.reps}`))
                        .join(' · ')
                    : t('workouts.focus.incomplete')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="px-[18px] pb-2 pt-2">
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSave}
          className={`h-16 items-center justify-center rounded-[18px] bg-primary ${busy ? 'opacity-60' : ''}`}
        >
          <Text className="text-[19px] text-white">
            {busy ? t('common.states.saving') : t('workouts.focus.completeAndSave')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 rounded-control border-[1.5px] border-line bg-surface px-2.5 py-3">
      <Text className="text-[22px] text-ink" style={tabular}>
        {value}
      </Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
