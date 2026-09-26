import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Card, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';
import { photoDraft } from '@/meals/photo-draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

export default function MealPhotoCapture() {
  const { destination = 'today', meal_id } = useLocalSearchParams<{
    destination?: 'meal' | 'today';
    meal_id?: string;
  }>();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parentRoute =
    destination === 'meal'
      ? ({ pathname: '/meals/[id]', params: { id: meal_id ?? 'new' } } as const)
      : '/meals';

  useEffect(() => {
    if (destination === 'meal' && (!meal_id || !draft.has(meal_id))) {
      Alert.alert('找不到餐點草稿', '請回到餐點頁重新開啟要編輯的餐點。', [
        { text: '返回餐點', onPress: () => router.replace('/meals') },
      ]);
    }
  }, [destination, meal_id]);

  const choose = async () => {
    setBusy(true);
    try {
      const analysis = await pickAndAnalyzeMealPhoto(setPreview);
      if (!analysis) return;
      photoDraft.set(analysis);
      router.replace({
        pathname: '/meals/photo-results',
        params: { destination, meal_id, analysis_id: analysis.id },
      });
    } catch (error) {
      const message =
        error instanceof ApiError && error.status >= 500
          ? '辨識服務目前未設定或暫時無法使用，請改用手動加入食物。'
          : error instanceof Error
            ? error.message
            : '照片辨識失敗，請稍後再試。';
      Alert.alert('無法辨識餐點', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <PrimaryButton onPress={choose} busy={busy}>
          {busy ? '辨識中…' : '選擇餐點照片'}
        </PrimaryButton>
      }
    >
      <Pressable accessibilityRole="button" onPress={() => backOrReplace(parentRoute)} disabled={busy}>
        <Text className="text-base text-primary">‹ 返回</Text>
      </Pressable>
      <Title sub="拍一張清楚、光線足夠的餐點照，我們會找出食物與估計份量。">辨識餐點照片</Title>

      {preview ? (
        <Image source={{ uri: preview }} className="h-64 w-full rounded-card bg-fill" resizeMode="cover" />
      ) : (
        <Card className="items-center gap-2 py-10">
          <Text className="text-4xl text-primary">⌁</Text>
          <Text className="text-base font-semibold text-ink">尚未選擇照片</Text>
          <Hint>不會自動儲存成餐點，確認後才會加入。</Hint>
        </Card>
      )}

      {busy ? (
        <Card className="flex-row items-center gap-3">
          <ActivityIndicator color={color.primary} />
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold text-ink">正在辨識照片</Text>
            <Hint>正在縮小、上傳並分析餐點。</Hint>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
