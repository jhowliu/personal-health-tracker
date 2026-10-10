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
import { backOrReplace } from '@/navigation/back';
import { WeeklyReport, weekRange, type Review } from '@/progress/WeeklyReport';
import { color } from '@/theme/tokens';

export default function WeekReport() {
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
        if (live) Alert.alert('讀不到週報', error instanceof ApiError ? error.message : '請稍後再試');
      });
    return () => {
      live = false;
    };
  }, [week]);

  return (
    <Screen footerSafeArea={false}>
      <BackLink label="週報" onPress={() => backOrReplace('/progress/weeks')} />
      {review ? (
        <>
          <Title sub={weekRange(review)}>週報</Title>
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
