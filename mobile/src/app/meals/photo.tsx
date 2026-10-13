import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import { Alert } from '@/components/alert';
import { CameraIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { BackLink, Card, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { draft } from '@/meals/draft';
import { photoErrorMessage, pickAndAnalyzeMealPhoto } from '@/meals/pick-and-analyze-photo';
import { photoDraft } from '@/meals/photo-draft';
import { backOrReplace } from '@/navigation/back';
import { color } from '@/theme/tokens';

export default function MealPhotoCapture() {
  const { t } = useI18n();
  const { destination = 'today', meal_id, date, slot } = useLocalSearchParams<{
    destination?: 'meal' | 'day' | 'today';
    meal_id?: string;
    date?: string;
    slot?: string;
  }>();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Busy covers choosing the source too; only once a photo is picked is it being recognized.
  const analyzing = busy && preview !== null;
  const parentRoute = destination === 'meal'
    ? ({ pathname: '/meals/[id]', params: { id: meal_id ?? 'new' } } as const)
    : destination === 'day'
      ? '/today'
      : '/meals';
  const parentLabel = destination === 'meal'
    ? t('meals.addFood.editMeal')
    : destination === 'day'
      ? t('common.labels.today')
      : t('navigation.meals');

  useEffect(() => {
    if (destination === 'meal' && (!meal_id || !draft.has(meal_id))) {
      Alert.alert(t('meals.photo.missingDraftTitle'), t('meals.addFood.missingDraftBody'), [
        { text: t('meals.photo.returnToMeals'), onPress: () => router.replace('/meals') },
      ]);
    } else if (destination === 'day' && (!date || !slot)) {
      Alert.alert(t('meals.photo.missingSlotTitle'), t('meals.addFood.missingSlotBody'), [
        { text: t('meals.photo.returnToToday'), onPress: () => router.replace('/today') },
      ]);
    }
  }, [date, destination, meal_id, slot, t]);

  const choose = async () => {
    setPreview(null);
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
      Alert.alert(t('meals.photo.recognitionFailed'), photoErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <PrimaryButton onPress={choose} disabled={busy} busy={analyzing}>
          {analyzing ? t('common.states.recognizing') : t('meals.photo.chooseMealPhoto')}
        </PrimaryButton>
      }
    >
      <BackLink label={parentLabel} onPress={() => backOrReplace(parentRoute)} disabled={busy} />
      <Title sub={t('meals.photo.subtitle')}>{t('meals.photo.title')}</Title>

      {preview ? (
        <Image source={{ uri: preview }} className="h-64 w-full rounded-card bg-fill" resizeMode="cover" />
      ) : (
        // The empty frame is where the photo goes, so tapping it picks one, like the button below.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('meals.photo.chooseMealPhoto')}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={choose}
          className="items-center gap-2 rounded-card border-2 border-dashed border-edge bg-surface px-4 py-10 active:opacity-70"
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
            <CameraIcon size={32} />
          </View>
          <Text className="text-base text-primary">{t('meals.photo.tapToChoose')}</Text>
          <Hint>{t('meals.photo.notSavedAutomatically')}</Hint>
        </Pressable>
      )}

      {analyzing ? (
        <Card className="flex-row items-center gap-3">
          <ActivityIndicator color={color.primary} />
          <View className="flex-1 gap-0.5">
            <Text className="text-base text-ink">{t('meals.photo.recognizingPhoto')}</Text>
            <Hint>{t('meals.photo.recognizingDetail')}</Hint>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
