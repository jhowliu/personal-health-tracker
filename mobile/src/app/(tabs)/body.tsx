import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { BodyStatRow } from '@/components/BodyStatRow';
import { ChevronIcon, ReportIcon } from '@/components/icons';
import { MonthCalendar } from '@/components/MonthCalendar';
import { Text } from '@/components/text';
import { TrendChart } from '@/components/TrendChart';
import { VolumeChart } from '@/components/VolumeChart';
import { Card, Empty, HeaderIconButton, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { formatDate } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';

type Summary = Schema<'BodySummaryOut'>;
type Log = Schema<'BodyLogOut'>;
type Volume = Schema<'VolumeTrendOut'>;

export default function BodyScreen() {
  const { t } = useI18n();
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
      Alert.alert(t('body.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    }
  }, [t]);

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
      <Title
        action={
          <HeaderIconButton
            icon={ReportIcon}
            accessibilityLabel={newReport ? t('body.weeklyReportNew') : t('body.weeklyReport')}
            badge={newReport}
            onPress={() => router.push('/progress/weeks')}
          />
        }
      >
        {t('body.title')}
      </Title>

      <Card>
        <MonthCalendar refreshKey={logs} />
      </Card>

      <View className="border-b border-line pb-4">
        <BodyStatRow stats={summary} />
      </View>

      <TrendChart title={t('body.weightTrend')} unit={t('body.lastThirtyDaysKg')} points={summary.weight_series} />
      <TrendChart title={t('body.waistTrend')} unit={t('body.lastThirtyDaysCm')} points={summary.waist_series} />
      {volume ? <VolumeChart trend={volume} /> : null}

      <SectionHeading
        action={
          logs.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showLogs }}
              accessibilityLabel={showLogs ? t('body.collapseRecords') : t('body.expandRecords', { count: logs.length })}
              onPress={() => setShowLogs((open) => !open)}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              className="flex-row items-center gap-1 active:opacity-70"
            >
              <Text className="text-base text-muted">
                {showLogs
                  ? t('common.actions.collapse')
                  : t(logs.length === 1 ? 'common.counts.entries.one' : 'common.counts.entries.other', {
                      count: logs.length,
                    })}
              </Text>
              <ChevronIcon direction={showLogs ? 'up' : 'down'} size={16} tint={color.muted} />
            </Pressable>
          ) : null
        }
      >
        {t('body.records')}
      </SectionHeading>
      {logs.length === 0 ? (
        <Empty compact sticker="scale">
          {t('body.noRecords')}
        </Empty>
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
                    {formatDate(parsed, { month: 'numeric', day: 'numeric', weekday: 'short' })}
                  </Text>
                  <Text className="text-base text-muted">
                    {[
                      log.weight_kg ? `${log.weight_kg.toFixed(1)} kg` : null,
                      log.waist_cm ? t('body.waistValue', { value: log.waist_cm.toFixed(1) }) : null,
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
