import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { Card, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { photoDraft, type PhotoAnalysis } from '@/meals/photo-draft';
import { color } from '@/theme/tokens';

type PhotoCreate = { id: string; upload_url: string; status: string };

export default function MealPhotoCapture() {
  const { destination = 'today', meal_id } = useLocalSearchParams<{
    destination?: 'meal' | 'today';
    meal_id?: string;
  }>();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要照片權限', source === 'camera' ? '請允許相機權限以拍攝餐點。' : '請允許相簿權限以選擇餐點照片。');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    await uploadAndAnalyze(asset.uri, asset.width, asset.height);
  };

  const uploadAndAnalyze = async (uri: string, width: number, height: number) => {
    setBusy(true);
    try {
      const resized = await manipulateAsync(
        uri,
        [{ resize: width >= height ? { width: 1024 } : { height: 1024 } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );
      const photo: PhotoCreate = await api.post('/meal-photos', { content_type: 'image/jpeg' });
      const image = await fetch(resized.uri);
      const upload = await fetch(photo.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: await image.blob(),
      });
      if (!upload.ok) throw new Error('照片上傳失敗，請確認網路後再試。');
      const analysis: PhotoAnalysis = await api.post(`/meal-photos/${photo.id}/analyze`);
      photoDraft.set(analysis);
      router.push({ pathname: '/meals/photo-results', params: { destination, meal_id } });
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
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={busy}>
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
      ) : (
        <View className="gap-3">
          <PrimaryButton onPress={() => choose('camera')}>拍照辨識</PrimaryButton>
          <PrimaryButton tone="plain" onPress={() => choose('library')}>
            從相簿選擇
          </PrimaryButton>
        </View>
      )}
    </Screen>
  );
}
