import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { Sheet } from '@/components/Sheet';
import { TrendChart } from '@/components/TrendChart';
import { ChevronIcon } from '@/components/icons';
import { Card, Field, Hint, PrimaryButton, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { syncWeighInReminder } from '@/notifications/reminder';
import { color } from '@/theme/tokens';

type Summary = Schema<'BodySummaryOut'>;
type Log = Schema<'BodyLogOut'>;

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

/** Waist is measured about once a week; inside this many days the form stops asking for it. */
const WAIST_INTERVAL_DAYS = 7;

type LogEntry = { date: string; weight: number | null; waist: number | null };

function isoDay(day: Date) {
  return new Date(day.getTime() - day.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function todayISO() {
  return isoDay(new Date());
}

function yesterdayISO() {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  return isoDay(day);
}

function daysBetween(from: string, to: string) {
  const ms = new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}

export default function BodyScreen() {
  const { profile } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  // The mode stays put while the sheet slides out, so its content does not change mid-animation.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'today' | 'other'>('today');

  const load = useCallback(async () => {
    try {
      const [fresh, history] = await Promise.all([
        api.get('/body-logs/summary'),
        api.get('/body-logs'),
      ]);
      setSummary(fresh);
      setLogs([...history].reverse());
    } catch (error) {
      Alert.alert('讀不到紀錄', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openSheet = (mode: 'today' | 'other') => {
    setSheetMode(mode);
    setSheetOpen(true);
  };

  /** Resolves true when the entry was saved, so the form knows whether to stay open. */
  const save = async (entry: LogEntry): Promise<boolean> => {
    try {
      await api.put(`/body-logs/${entry.date}`, { weight_kg: entry.weight, waist_cm: entry.waist });
      await load();
      setSheetOpen(false);
      // Logging today's weigh-in drops today's reminder if it has not fired yet.
      if (entry.date === todayISO()) {
        void syncWeighInReminder(profile?.profile.reminder_time ?? null).catch(() => {});
      }
      return true;
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
      return false;
    }
  };

  if (!summary) {
    return (
      <Screen scroll={false} footerSafeArea={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  // `logs` is newest first.
  const today = todayISO();
  const todayLog = logs.find((log) => log.date === today);
  const waistLog = logs.find((log) => log.waist_cm !== null);
  const lastWaist =
    waistLog && waistLog.waist_cm !== null
      ? { cm: waistLog.waist_cm, days: daysBetween(waistLog.date, today) }
      : null;
  const waistDue = !lastWaist || lastWaist.days >= WAIST_INTERVAL_DAYS;

  return (
    <Screen footerSafeArea={false}>
      <Title>身形追蹤</Title>

      <Card className="gap-3">
        {todayLog ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="修改今天的紀錄"
            onPress={() => openSheet('today')}
            className="gap-2"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted">今天已記錄</Text>
              <View className="flex-row items-center gap-0.5">
                <Text className="text-base text-primary">修改</Text>
                <ChevronIcon direction="right" size={16} />
              </View>
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="體重"
                value={todayLog.weight_kg !== null ? `${todayLog.weight_kg.toFixed(1)} kg` : '—'}
              />
              {todayLog.waist_cm !== null ? (
                <Stat label="腰圍" value={`${todayLog.waist_cm.toFixed(1)} cm`} />
              ) : lastWaist ? (
                <Stat label="腰圍" value={`${lastWaist.cm.toFixed(1)} cm`} note={`${lastWaist.days} 天前量的`} />
              ) : (
                <Stat label="腰圍" value="—" />
              )}
            </View>
          </Pressable>
        ) : (
          <LogForm
            initial={{ date: today, weight: null, waist: null }}
            dateEditable={false}
            showWaist={waistDue}
            onSave={save}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => openSheet('other')}
          className="min-h-[44px] justify-center self-start"
        >
          <Text className="text-sm text-primary">補記其他天</Text>
        </Pressable>
      </Card>

      <Sheet
        visible={sheetOpen}
        title={sheetMode === 'today' ? '修改今天的紀錄' : '補記其他天'}
        onClose={() => setSheetOpen(false)}
      >
        <View className="pb-4">
          {sheetMode === 'today' ? (
            <LogForm
              initial={{ date: today, weight: todayLog?.weight_kg ?? null, waist: todayLog?.waist_cm ?? null }}
              dateEditable={false}
              showWaist
              onSave={save}
            />
          ) : (
            <LogForm
              initial={{ date: yesterdayISO(), weight: null, waist: null }}
              dateEditable
              showWaist
              onSave={save}
            />
          )}
        </View>
      </Sheet>

      <View className="flex-row gap-2">
        <Kpi label="本週平均" value={summary.week_avg_weight?.toFixed(1) ?? '—'} />
        <Kpi
          label="比上週"
          value={summary.week_avg_delta === null ? '—' : summary.week_avg_delta.toFixed(1)}
          tone={
            summary.week_avg_delta === null ? 'ink' : summary.week_avg_delta <= 0 ? 'good' : 'warm'
          }
        />
        <Kpi label="腰圍" value={summary.latest_waist?.toFixed(1) ?? '—'} />
      </View>

      <TrendChart title="體重" unit="kg，近 30 天" points={summary.weight_series} />
      <TrendChart
        title="腰圍"
        unit="cm，近 30 天"
        points={summary.waist_series}
        stroke={color.good}
      />

      <SectionHeading>紀錄</SectionHeading>
      <Card className="py-0">
        {logs.length === 0 ? (
          <Text className="py-6 text-center text-base text-muted">還沒有紀錄</Text>
        ) : (
          <Rows>
            {logs.map((log) => {
              const parsed = new Date(`${log.date}T00:00:00`);
              return (
                <View
                  key={log.date}
                  className="flex-row items-center justify-between py-3"
                >
                  <Text className="text-base text-ink">
                    {parsed.getMonth() + 1}/{parsed.getDate()} {WEEKDAY[parsed.getDay()]}
                  </Text>
                  <Text className="text-base text-muted">
                    {[
                      log.weight_kg ? `${log.weight_kg.toFixed(1)} kg` : null,
                      log.waist_cm ? `腰 ${log.waist_cm.toFixed(1)} cm` : null,
                    ]
                      .filter(Boolean)
                      .join(',')}
                  </Text>
                </View>
              );
            })}
          </Rows>
        )}
      </Card>
    </Screen>
  );
}

/** Weight and waist inputs with a save button. Owns its own drafts, so each mount starts from `initial`. */
function LogForm({
  initial,
  dateEditable,
  showWaist,
  onSave,
}: {
  initial: LogEntry;
  dateEditable: boolean;
  showWaist: boolean;
  onSave: (entry: LogEntry) => Promise<boolean>;
}) {
  const [date, setDate] = useState(initial.date);
  const [weight, setWeight] = useState(initial.weight === null ? '' : initial.weight.toFixed(1));
  const [waist, setWaist] = useState(initial.waist === null ? '' : initial.waist.toFixed(1));
  const [busy, setBusy] = useState(false);

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const hasValue = weight !== '' || (showWaist && waist !== '');

  const submit = async () => {
    setBusy(true);
    await onSave({
      date,
      weight: weight ? Number(weight) : null,
      waist: showWaist && waist ? Number(waist) : null,
    });
    setBusy(false);
  };

  return (
    <View className="gap-3">
      {dateEditable ? (
        <View className="flex-row">
          <Field label="日期" value={date} onChangeText={setDate} autoCapitalize="none" />
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <Field label="體重" suffix="kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        {showWaist ? (
          <Field label="腰圍" suffix="cm" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" />
        ) : null}
      </View>
      <PrimaryButton onPress={submit} disabled={busy || !validDate || !hasValue}>
        {busy ? '儲存中…' : '儲存紀錄'}
      </PrimaryButton>
      {showWaist ? <Hint>兩個可以只填一個。腰圍一週量一次就好。</Hint> : null}
    </View>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="font-display text-2xl font-bold text-ink">{value}</Text>
      {note ? <Text className="text-xs text-muted">{note}</Text> : null}
    </View>
  );
}

function Kpi({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'good' | 'warm' }) {
  const text = { ink: 'text-ink', good: 'text-good', warm: 'text-warm' }[tone];
  return (
    <View className="flex-1 gap-0.5 rounded-card border border-line bg-surface p-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={`font-display text-2xl font-bold ${text}`}>{value}</Text>
    </View>
  );
}
