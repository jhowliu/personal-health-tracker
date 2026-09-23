import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { TrendChart } from '@/components/TrendChart';
import { Card, Field, Hint, PrimaryButton, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

type Summary = Schema<'BodySummaryOut'>;
type Log = Schema<'BodyLogOut'>;

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function BodyScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [busy, setBusy] = useState(false);

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

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/body-logs/${date}`, {
        weight_kg: weight ? Number(weight) : null,
        waist_cm: waist ? Number(waist) : null,
      });
      setWeight('');
      setWaist('');
      await load();
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  if (!summary) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>身形追蹤</Title>

      <Card className="gap-3">
        <Field label="日期" value={date} onChangeText={setDate} autoCapitalize="none" />
        <View className="flex-row gap-3">
          <Field label="體重" suffix="kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Field label="腰圍" suffix="cm" value={waist} onChangeText={setWaist} keyboardType="decimal-pad" />
        </View>
        <PrimaryButton onPress={save} disabled={busy || (!weight && !waist)}>
          {busy ? '儲存中…' : '儲存紀錄'}
        </PrimaryButton>
        <Hint>兩個可以只填一個。腰圍一週量一次就好。</Hint>
      </Card>

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

      <TrendChart title="體重" unit="kg,近 30 天" points={summary.weight_series} />
      <TrendChart
        title="腰圍"
        unit="cm,近 30 天"
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

function Kpi({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'good' | 'warm' }) {
  const text = { ink: 'text-ink', good: 'text-good', warm: 'text-warm' }[tone];
  return (
    <View className="flex-1 gap-0.5 rounded-card border border-line bg-surface p-3">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={`font-display text-2xl font-bold ${text}`}>{value}</Text>
    </View>
  );
}
