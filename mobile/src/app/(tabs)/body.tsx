import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { ChevronIcon, ReportIcon } from '@/components/icons';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Text } from '@/components/text';
import { TrendChart } from '@/components/TrendChart';
import { VolumeChart } from '@/components/VolumeChart';
import { Card, HeaderIconButton, Rows, Screen, SectionHeading } from '@/components/ui';
import { color } from '@/theme/tokens';

type Summary = Schema<'BodySummaryOut'>;
type Log = Schema<'BodyLogOut'>;
type Volume = Schema<'VolumeTrendOut'>;

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export default function BodyScreen() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [volume, setVolume] = useState<Volume | null>(null);
  // The charts already tell the story; the raw list stays folded until asked for.
  const [showLogs, setShowLogs] = useState(false);
  // A week whose report has not been read yet puts a dot on the report button.
  const [newReport, setNewReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const [fresh, history, weeks] = await Promise.all([
        api.get('/body-logs/summary'),
        api.get('/body-logs'),
        api.get('/progress/volume'),
      ]);
      setSummary(fresh);
      setLogs([...history].reverse());
      setVolume(weeks);
      api
        .get('/progress/weekly/pending')
        .then((pending) => setNewReport(pending !== null))
        // Only the dot depends on it.
        .catch(() => {});
    } catch (error) {
      Alert.alert('讀不到紀錄', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!summary) {
    return (
      <Screen scroll={false} footerSafeArea={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footerSafeArea={false}>
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-[28px] leading-[38px] text-ink">
          進度
        </Text>
        <HeaderIconButton
          icon={ReportIcon}
          accessibilityLabel={newReport ? '週報，有新的一週' : '週報'}
          badge={newReport}
          onPress={() => router.push('/progress/weeks')}
        />
      </View>

      <Card>
        <MonthCalendar refreshKey={logs} />
      </Card>

      <View className="flex-row border-b border-line pb-4">
        <Kpi label="本週平均" value={summary.week_avg_weight?.toFixed(1) ?? '—'} unit="kg" />
        <Kpi
          label="比上週"
          value={
            summary.week_avg_delta === null
              ? '—'
              : `${summary.week_avg_delta > 0 ? '+' : summary.week_avg_delta < 0 ? '−' : ''}${Math.abs(summary.week_avg_delta).toFixed(1)}`
          }
          unit="kg"
          tone={
            summary.week_avg_delta === null ? 'ink' : summary.week_avg_delta <= 0 ? 'good' : 'warm'
          }
        />
        <Kpi label="腰圍" value={summary.latest_waist?.toFixed(1) ?? '—'} unit="cm" />
      </View>

      <TrendChart title="體重" unit="kg，近 30 天" points={summary.weight_series} />
      <TrendChart title="腰圍" unit="cm，近 30 天" points={summary.waist_series} />
      {volume ? <VolumeChart trend={volume} /> : null}

      <SectionHeading
        action={
          logs.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showLogs }}
              accessibilityLabel={showLogs ? '收起紀錄' : `展開 ${logs.length} 筆紀錄`}
              onPress={() => setShowLogs((open) => !open)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              className="flex-row items-center gap-1 active:opacity-70"
            >
              <Text className="text-base text-muted">{showLogs ? '收起' : `${logs.length} 筆`}</Text>
              <ChevronIcon direction={showLogs ? 'up' : 'down'} size={16} tint={color.muted} />
            </Pressable>
          ) : null
        }
      >
        紀錄
      </SectionHeading>
      {logs.length === 0 ? (
        <Card>
          <Text className="py-2 text-center text-base text-muted">還沒有紀錄</Text>
        </Card>
      ) : showLogs ? (
        <Card className="py-0">
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
        </Card>
      ) : null}
    </Screen>
  );
}

function Kpi({
  label,
  value,
  unit,
  tone = 'ink',
}: {
  label: string;
  value: string;
  unit: string;
  tone?: 'ink' | 'good' | 'warm';
}) {
  const text = { ink: 'text-ink', good: 'text-good', warm: 'text-warm' }[tone];
  return (
    <View className="flex-1 gap-0.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={`text-[25px] ${text}`}>
        {value}
        {value === '—' ? null : <Text className="text-xs text-muted"> {unit}</Text>}
      </Text>
    </View>
  );
}
