import * as ImagePicker from 'expo-image-picker';

import { ensureAiConsent } from '@/ai/consent';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/alert';
import { translate } from '@/i18n/translator';
import { analyzeMealPhoto } from '@/meals/analyze-photo';

/** What to tell the user when picking or recognizing a meal photo fails. */
export function photoErrorMessage(error: unknown) {
  return error instanceof ApiError && error.status >= 500
    ? translate('meals.photo.serviceUnavailable')
    : error instanceof Error
      ? error.message
      : translate('meals.photo.recognitionFailed');
}

type PhotoSource = 'camera' | 'library';

function choosePhotoSource(): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    Alert.alert(translate('meals.photo.chooseSourceTitle'), undefined, [
      { text: translate('meals.photo.takePhoto'), onPress: () => resolve('camera') },
      { text: translate('meals.photo.chooseLibrary'), onPress: () => resolve('library') },
      { text: translate('common.actions.cancel'), style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export async function pickAndAnalyzeMealPhoto(onPicked?: (uri: string) => void) {
  // The photo goes to the AI provider, so the user agrees to that before choosing one.
  if (!(await ensureAiConsent())) return null;
  const source = await choosePhotoSource();
  if (!source) return null;

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      translate('meals.photo.permissionTitle'),
      translate(source === 'camera' ? 'meals.photo.cameraPermissionBody' : 'meals.photo.libraryPermissionBody'),
    );
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled) return null;

  const asset = result.assets[0];
  onPicked?.(asset.uri);
  return analyzeMealPhoto(asset.uri, asset.width, asset.height);
}
