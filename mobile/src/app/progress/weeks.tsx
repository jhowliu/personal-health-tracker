/**
 * Weekly reports, newest first, opened from the report button on 進度; each opens the same
 * report the pop-up shows. The one not read yet is tagged 新.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { BackLink, Card, Empty, Rows, Screen, Tag, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { weekRange } from '@/progress/WeeklyReport';
import { color } from '@/theme/tokens';

type Week = Schema<'WeekSummaryOut'>;

export default function PastWeeks() {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [unread, setUnread] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      api
        .get('/progress/weekly/pending')
        .then((pending) => {
          if (live) setUnread(pending?.start ?? null);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  useEffect(() => {
    let live = true;
    api
      .get('/progress/weeks')
      .then((fresh) => {
        if (live) setWeeks(fresh);
      })
      .catch((error) => {
        if (!live) return;
        setWeeks([]);
        Alert.alert(t('progress.loadReportFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
      });
    return () => {
      live = false;
    };
  }, [t]);

  return (
    <Screen footerSafeArea={false}>
      <BackLink label={t('body.title')} onPress={() => backOrReplace('/body')} />
      <Title>{t('progress.weeklyReport')}</Title>
      {weeks === null ? (
        <View className="items-center py-12">
          <ActivityIndicator color={color.primary} />
        </View>
      ) : weeks.length === 0 ? (
        <Empty>{t('progress.noReports')}</Empty>
      ) : (
        <Card className="py-0">
          <Rows>
            {weeks.map((week) => (
              <Pressable
                key={week.start}
                accessibilityRole="button"
                accessibilityLabel={t('progress.reportAccessibility', {
                  range: weekRange(week),
                  days: t(week.days_complete === 1 ? 'common.counts.days.one' : 'common.counts.days.other', {
                    count: week.days_complete,
                  }),
                  workouts: t(week.workouts === 1 ? 'common.counts.workouts.one' : 'common.counts.workouts.other', {
                    count: week.workouts,
                  }),
                })}
                onPress={() => router.push(`/progress/${week.start}`)}
                className="min-h-[52px] flex-row items-center justify-between gap-3 py-3 active:opacity-70"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-base text-ink">{weekRange(week)}</Text>
                  {week.start === unread ? <Tag label={t('common.states.new')} tone="primary" /> : null}
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-muted">
                    {t('progress.reportSummary', {
                      days: t(week.days_complete === 1 ? 'common.counts.days.one' : 'common.counts.days.other', {
                        count: week.days_complete,
                      }),
                      workouts: t(week.workouts === 1 ? 'common.counts.workouts.one' : 'common.counts.workouts.other', {
                        count: week.workouts,
                      }),
                    })}
                  </Text>
                  <ChevronIcon direction="right" size={16} tint={color.muted} />
                </View>
              </Pressable>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}
