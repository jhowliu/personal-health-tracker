import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, View } from 'react-native';

import { CameraIcon } from '@/components/icons';
import { BackLink, Card, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { draft } from '@/meals/draft';
import { photoErrorMessage, pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';
import { photoDraft } from '@/meals/photo-draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

export default function MealPhotoCapture() {
  const { destination = 'today', meal_id, date, slot } = useLocalSearchParams<{
    destination?: 'meal' | 'day' | 'today';
    meal_id?: string;
    date?: string;
    slot?: string;
  }>();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parentRoute = destination === 'meal'
    ? ({ pathname: '/meals/[id]', params: { id: meal_id ?? 'new' } } as const)
    : destination === 'day'
      ? '/today'
      : '/meals';
  const parentLabel = destination === 'meal' ? '編輯餐點' : destination === 'day' ? '今天' : '餐點';

  useEffect(() => {
    if (destination === 'meal' && (!meal_id || !draft.has(meal_id))) {
      Alert.alert('找不到餐點草稿', '請回到餐點頁重新開啟要編輯的餐點。', [
        { text: '返回餐點', onPress: () => router.replace('/meals') },
      ]);
    } else if (destination === 'day' && (!date || !slot)) {
      Alert.alert('找不到餐次', '請回到今日流程重新選擇早餐、午餐或晚餐。', [
        { text: '返回今天', onPress: () => router.replace('/today') },
      ]);
    }
  }, [date, destination, meal_id, slot]);

  const choose = async () => {
    setBusy(true);
    try {
      const analysis = await pickAndAnalyzeMealPhoto(setPreview);
      if (!analysis) return;
      photoDraft.set(analysis);
      router.replace({
        pathname: '/meals/photo-results',
        params: { destination, meal_id, date, slot, analysis_id: analysis.id },
      });
    } catch (error) {
      Alert.alert('無法辨識餐點', photoErrorMessage(error));
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
      <BackLink label={parentLabel} onPress={() => backOrReplace(parentRoute)} disabled={busy} />
      <Title sub="拍一張清楚、光線足夠的餐點照，我們會找出食物與估計份量。">辨識餐點照片</Title>

      {preview ? (
        <Image source={{ uri: preview }} className="h-64 w-full rounded-card bg-fill" resizeMode="cover" />
      ) : (
        <Card className="items-center gap-2 py-10">
          <CameraIcon size={40} />
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
