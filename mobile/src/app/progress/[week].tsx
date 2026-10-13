/**
 * One week's report, opened from the list behind the report button on 進度. Reading it here
 * counts as seen, the same as closing the pop-up.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Alert } from '@/components/alert';
import { BackLink, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { WeeklyReport, weekRange, type Review } from '@/progress/WeeklyReport';
import { color } from '@/theme/tokens';

export default function WeekReport() {
  const { t } = useI18n();
  const { week } = useLocalSearchParams<{ week: string }>();
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    if (!week) return;
    let live = true;
    api
      .get(`/progress/weekly?week=${week}`)
      .then((fresh: Review) => {
        if (!live) return;
        setReview(fresh);
        api.post(`/progress/weekly/${fresh.start}/seen`).catch(() => {});
      })
      .catch((error) => {
        if (live) Alert.alert(t('progress.loadReportFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
      });
    return () => {
      live = false;
    };
  }, [week, t]);

  return (
    <Screen footerSafeArea={false}>
      <BackLink label={t('progress.weeklyReport')} onPress={() => backOrReplace('/progress/weeks')} />
      {review ? (
        <>
          <Title sub={weekRange(review)}>{t('progress.weeklyReport')}</Title>
          <WeeklyReport review={review} />
        </>
      ) : (
        <View className="items-center py-12">
          <ActivityIndicator color={color.primary} />
        </View>
      )}
    </Screen>
  );
}
