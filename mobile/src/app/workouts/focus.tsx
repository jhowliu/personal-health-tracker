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
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { CloseIcon, PlusIcon } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { Chip, Hint, PrimaryButton } from '@/components/ui';
import { todayISO } from '@/dates';
import { color } from '@/theme/tokens';
import { RestRing, Segments, SetDots, Stepper, clock, kg, tabular } from '@/workouts/focus/parts';
import { buzz, cancelRestAlarm, ensureRestAlarmPermission, scheduleRestAlarm } from '@/workouts/focus/rest-alarm';
import {
  REST_STEP_SEC,
  adjustRest,
  awaitingFeedback,
  completeCurrent,
  elapsedMs,
  fromWorkout,
  isDone,
  isFinished,
  jumpTo,
  nextIndex,
  pause,
  restLeftSec,
  restore,
  resume,
  setFeedback,
  settleRest,
  skipRest,
  step,
  summary,
  type Effort,
  type FocusExercise,
  type Session,
} from '@/workouts/focus/session';
import { clearSession, loadSession, saveSession } from '@/workouts/focus/storage';

type Workout = Schema<'WorkoutExecutionOut'>;

const EFFORTS: { id: Effort; label: string }[] = [
  { id: 'easy', label: '輕鬆' },
  { id: 'appropriate', label: '剛好' },
  { id: 'hard', label: '吃力' },
];
const EFFORT_WORD: Record<Effort, string> = { easy: '輕鬆', appropriate: '剛好', hard: '吃力' };
/** A second tap within this window is the same tap, not a second set (spec §6). */
const DOUBLE_TAP_MS = 300;

export default function FocusWorkout() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [title, setTitle] = useState('今天的訓練');
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
          setTitle(workout.template?.name ?? '今天的訓練');
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
          Alert.alert('讀不到今天的訓練', error instanceof ApiError ? error.message : '請稍後再試。');
          router.back();
        }
      })();
      return () => {
        active = false;
      };
    }, [date]),
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
        showToast('休息結束，開始下一組');
      }
      const timer = cardioRef.current;
      const exercise = current?.exercises[current.currentIndex];
      if (timer.since !== null && exercise?.kind === 'time' && timer.spentMs + at - timer.since >= exercise.minutes * 60000) {
        setCardio({ since: null, spentMs: exercise.minutes * 60000 });
        buzz();
        showToast('時間到');
      }
    }, 500);
    return () => clearInterval(id);
  }, [showToast]);

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
    return next.rest?.nextIsNewExercise ? `下一個：${coming.name}` : `開始第 ${coming.logs.length + 1} 組`;
  };

  const complete = async () => {
    const at = Date.now();
    if (busy || at - lastTap.current < DOUBLE_TAP_MS) return;
    lastTap.current = at;
    const { session: next, log, finished } = completeCurrent(session, at);
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
      Alert.alert('這組沒有記錄到', error instanceof ApiError ? error.message : '請確認網路後再按一次。');
      return;
    } finally {
      setBusy(false);
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
      Alert.alert('回饋沒有存到', error instanceof ApiError ? error.message : '請稍後再試。');
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
      Alert.alert('儲存失敗', error instanceof ApiError ? error.message : '請稍後再試。');
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
  const finalSet = exercise.kind === 'time' || exercise.logs.length === exercise.plannedSets - 1;
  const after = nextIndex(session.exercises, session.currentIndex);
  const lastOfDay = finalSet && after === -1;
  const finished = resting ? session.exercises.find((candidate) => candidate.itemId === session.rest?.finishedItemId) : undefined;
  const cardioLeftSec =
    (exercise.minutes * 60000 - (cardio.spentMs + (cardio.since !== null ? now - cardio.since : 0))) / 1000;
  const anyLogged = session.exercises.some((candidate) => candidate.logs.length > 0 || candidate.timeDone);

  return (
    <SafeAreaView edges={['top', 'bottom']} className={`flex-1 ${resting ? 'bg-primary-soft' : 'bg-bg'}`}>
      <View className="flex-row items-center justify-between px-3.5 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="離開訓練"
          onPress={() => setSheet('exit')}
          className="h-[46px] w-[46px] items-center justify-center rounded-full bg-ink/5"
        >
          <CloseIcon size={20} tint={color.ink} />
        </Pressable>
        <View className="items-center">
          <Text className="text-xs text-muted">訓練時間</Text>
          <Text className="text-xl font-bold text-ink" style={tabular}>
            {clock(elapsedMs(session, now) / 1000)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`動作清單，目前第 ${session.currentIndex + 1} 個，共 ${session.exercises.length} 個`}
          onPress={() => setSheet('list')}
          className="h-[46px] flex-row items-center rounded-full bg-ink/5 px-3.5"
        >
          <Text className="text-[15px] font-semibold text-ink" style={tabular}>
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
            <Text className="text-sm text-warm">開啟通知後，休息結束時手機會提醒你。到系統設定開啟，或點這裡關閉提示。</Text>
          </Pressable>
        ) : null}
        {resting ? (
          <Text className="text-sm font-bold text-primary">
            {session.rest?.nextIsNewExercise ? '下一個動作' : `下一組 · 第 ${setNumber} / ${exercise.plannedSets} 組`}
          </Text>
        ) : null}
        <Text className="text-[30px] font-bold leading-tight text-ink">{exercise.name}</Text>
        <Text className="text-[15px] text-muted">
          {exercise.kind === 'time'
            ? `目標 ${exercise.targetMin} 分鐘`
            : `目標 ${exercise.plannedSets} 組${exercise.repsLabel ? ` × ${exercise.repsLabel} 下` : ''}`}
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
              className="h-[50px] justify-center rounded-[18px] bg-ink/5 px-5"
            >
              <Text className="text-base font-semibold text-ink">
                {cardio.since !== null ? '暫停' : cardio.spentMs > 0 ? '繼續計時' : '開始計時'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center justify-between pb-1.5 pt-4">
            <View className="flex-row items-baseline gap-1.5">
              <Text className="text-[52px] font-extrabold text-primary" style={tabular}>
                第 {setNumber}
              </Text>
              <Text className="text-[17px] text-muted">/ {exercise.plannedSets} 組</Text>
            </View>
            <SetDots done={exercise.logs.length} total={exercise.plannedSets} />
          </View>
        )}

        {finished ? <FeedbackAsk exercise={finished} onPick={giveFeedback} /> : null}

        <Text className="mt-2 text-[13px] text-muted">{carriedNote(exercise)}</Text>
        {exercise.kind === 'time' ? (
          <>
            <Stepper
              label="實際時間"
              value={String(exercise.minutes)}
              unit="分鐘"
              onStep={(direction) => setSession(step(session, 'minutes', direction))}
            />
            {exercise.treadmill ? (
              <>
                <Stepper
                  label="速度"
                  value={exercise.speedKmh === null ? '—' : kg(exercise.speedKmh)}
                  unit="km/h"
                  onStep={(direction) => setSession(step(session, 'speed', direction))}
                />
                <Stepper
                  label="坡度"
                  value={exercise.inclinePct === null ? '—' : kg(exercise.inclinePct)}
                  unit="%"
                  onStep={(direction) => setSession(step(session, 'incline', direction))}
                />
                <Text className="text-[13px] text-muted">
                  {exercise.speedKmh === null
                    ? '選填：填了速度和坡度，熱量會照實際走或跑的強度算。'
                    : '熱量會照這個速度和坡度算。'}
                </Text>
              </>
            ) : null}
          </>
        ) : (
          <>
            {exercise.weightKg !== null ? (
              <Stepper
                label="重量"
                value={kg(exercise.weightKg)}
                unit="kg"
                onStep={(direction) => setSession(step(session, 'weight', direction))}
              />
            ) : null}
            <Stepper
              label="次數"
              value={String(exercise.reps)}
              unit="下"
              onStep={(direction) => setSession(step(session, 'reps', direction))}
            />
          </>
        )}

        {exercise.kind === 'sets' && exercise.logs.length ? (
          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {exercise.logs.map((log, index) => (
              <View key={index} className="rounded-full bg-good-soft px-2.5 py-1.5">
                <Text className="text-[13px] font-semibold text-good" style={tabular}>
                  ✓ 第 {index + 1} 組 {log.weightKg !== null ? `${kg(log.weightKg)} × ${log.reps}` : `× ${log.reps}`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className="gap-2 px-[18px] pb-2 pt-2">
        {resting ? (
          <View className="flex-row gap-2.5">
            <DockButton label={`−${REST_STEP_SEC} 秒`} onPress={() => nudgeRest(-REST_STEP_SEC)} />
            <DockButton label={`+${REST_STEP_SEC} 秒`} onPress={() => nudgeRest(REST_STEP_SEC)} />
            <Pressable
              accessibilityRole="button"
              onPress={endRest}
              className="h-16 flex-1 items-center justify-center rounded-[18px] border-2 border-primary bg-surface/60"
            >
              <Text className="text-[17px] font-bold text-primary">略過休息</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {finalSet ? (
              <Text className="text-center text-[13px] text-muted">
                {after !== -1
                  ? `${exercise.kind === 'time' ? '做完這個動作' : '做完這組'}，下一個：${session.exercises[after].name}`
                  : exercise.kind === 'time'
                    ? '這是今天最後一個動作'
                    : '這是今天最後一組'}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={complete}
              className={`h-16 items-center justify-center rounded-[18px] bg-primary ${busy ? 'opacity-60' : ''}`}
            >
              <Text className="text-[19px] font-bold text-white">
                {busy
                  ? '記錄中…'
                  : exercise.kind === 'time'
                    ? '完成這個動作'
                    : lastOfDay
                      ? '完成最後一組'
                      : `完成第 ${setNumber} 組`}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {toast ? (
        <View pointerEvents="none" className="absolute bottom-32 self-center rounded-full bg-ink px-4 py-2.5">
          <Text className="text-sm text-white">{toast}</Text>
        </View>
      ) : null}

      <Sheet visible={sheet === 'list'} title="今天的動作" onClose={() => setSheet(null)}>
        <Hint>器材被占用時，可以先換別的動作做。</Hint>
        {session.exercises.map((candidate, index) => {
          const done = isDone(candidate);
          const current = index === session.currentIndex;
          const status = done
            ? '✓ 完成'
            : current
              ? '目前'
              : candidate.logs.length
                ? `${candidate.logs.length} / ${candidate.plannedSets} 組`
                : '未開始';
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
                accessibilityLabel={`改做${candidate.name}`}
                disabled={done || current}
                onPress={() => switchTo(index)}
                className="min-h-14 flex-1 flex-row items-center justify-between gap-2"
              >
                <Text className="flex-1 text-base font-semibold text-ink">
                  {index + 1}. {candidate.name}
                </Text>
                <Text
                  className={`text-sm ${done ? 'font-semibold text-good' : current ? 'font-semibold text-primary' : 'text-muted'}`}
                >
                  {status}
                </Text>
              </Pressable>
              {swappable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`把${candidate.name}換成其他動作`}
                  onPress={() => openElsewhere(replacePath(candidate))}
                  className="min-h-[36px] justify-center rounded-full border border-primary bg-surface px-3"
                >
                  <Text className="text-sm font-semibold text-primary">換動作</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <PrimaryButton tone="plain" icon={PlusIcon} onPress={() => openElsewhere(`/workouts/add-today?date=${date}&from=focus`)}>
          加入動作
        </PrimaryButton>
      </Sheet>

      <Sheet visible={sheet === 'exit'} title="要離開訓練嗎？" onClose={() => setSheet(null)}>
        <Hint>已完成的組數都已經記下來了。</Hint>
        <PrimaryButton onPress={() => setSheet(null)}>繼續訓練</PrimaryButton>
        <PrimaryButton tone="plain" onPress={leave}>
          暫停並離開，稍後再繼續
        </PrimaryButton>
        {anyLogged ? (
          <Pressable accessibilityRole="button" onPress={finishEarly} className="min-h-[44px] items-center justify-center">
            <Text className="text-base font-semibold text-primary">結束並儲存</Text>
          </Pressable>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

/** Where the stepper values came from: today's last set, an earlier day, or the plan. */
function carriedNote(exercise: FocusExercise) {
  if (exercise.kind === 'time') return `課表 ${exercise.targetMin} 分鐘，已帶入`;
  if (exercise.logs.length) return '沿用上一組，可以再調整';
  const last = exercise.last;
  if (!last) return '照課表帶入';
  const feeling = last.effort ? `（${EFFORT_WORD[last.effort]}）` : '';
  if (last.weightKg === null) return `上次 ${last.reps ?? '-'} 下${feeling}，已帶入`;
  const suggested =
    exercise.suggestedWeightKg !== null && exercise.suggestedWeightKg !== last.weightKg
      ? `，建議 ${kg(exercise.suggestedWeightKg)} kg`
      : '';
  return `上次 ${kg(last.weightKg)} kg × ${last.reps ?? '-'}${feeling}${suggested}，已帶入`;
}

function DockButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-16 items-center justify-center rounded-[18px] bg-ink/5 px-4"
    >
      <Text className="text-base font-semibold text-ink" style={tabular}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Asked once a whole exercise is done; optional, so the next set never waits on it. */
function FeedbackAsk({ exercise, onPick }: { exercise: FocusExercise; onPick: (exercise: FocusExercise, effort: Effort) => void }) {
  return (
    <View className="gap-2 rounded-card bg-surface/70 p-3">
      <Text className="text-sm text-ink">「{exercise.name}」感覺如何？下次會依這個調整重量。</Text>
      <View className="flex-row gap-2">
        {EFFORTS.map((effort) => (
          <Chip
            key={effort.id}
            label={effort.label}
            selected={exercise.feedback === effort.id}
            onPress={() => onPick(exercise, effort.id)}
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
  const totals = summary(session);
  const asking = awaitingFeedback(session);
  // Keep a just-answered exercise on screen until save, so the chip shows what was picked.
  const [asked] = useState(() => new Set(asking.map((exercise) => exercise.itemId)));
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-[18px] pb-6 pt-6">
        <View>
          <Text className="text-[32px] font-extrabold text-ink">今天練完了</Text>
          <Text className="text-sm text-muted">
            {title} · {session.exercises.length} 個動作
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Stat value={clock(elapsedSec)} label="訓練時間" />
          <Stat value={String(totals.sets)} label="完成組數" />
          <Stat value={Math.round(totals.volumeKg).toLocaleString('en-US')} label="總量 kg" />
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
                <Text className="flex-1 text-base font-semibold text-ink">{exercise.name}</Text>
                {newRecord ? (
                  <View className="rounded-full bg-primary-soft px-2.5 py-0.5">
                    <Text className="text-xs font-bold text-primary">新紀錄</Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-0.5 text-[13px] text-muted" style={tabular}>
                {exercise.kind === 'time'
                  ? exercise.timeDone
                    ? [
                        `${exercise.minutes} 分鐘`,
                        exercise.speedKmh !== null ? `${kg(exercise.speedKmh)} km/h` : null,
                        exercise.speedKmh !== null && exercise.inclinePct !== null ? `坡度 ${kg(exercise.inclinePct)}%` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : '未完成'
                  : exercise.logs.length
                    ? exercise.logs
                        .map((log) => (log.weightKg !== null ? `${kg(log.weightKg)} × ${log.reps}` : `× ${log.reps}`))
                        .join(' · ')
                    : '未完成'}
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
          <Text className="text-[19px] font-bold text-white">{busy ? '儲存中…' : '完成並儲存'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 rounded-[14px] bg-fill px-2.5 py-3">
      <Text className="text-[22px] font-bold text-ink" style={tabular}>
        {value}
      </Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
