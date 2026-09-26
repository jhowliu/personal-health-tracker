import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { analyzeMealPhoto } from '@/meals/analyze-photo';

type PhotoSource = 'camera' | 'library';

function choosePhotoSource(): Promise<PhotoSource | null> {
  return new Promise((resolve) => {
    Alert.alert('選擇照片來源', undefined, [
      { text: '拍照', onPress: () => resolve('camera') },
      { text: '從相簿選擇', onPress: () => resolve('library') },
      { text: '取消', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

export async function pickAndAnalyzeMealPhoto(onPicked?: (uri: string) => void) {
  const source = await choosePhotoSource();
  if (!source) return null;

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      '需要照片權限',
      source === 'camera' ? '請允許相機權限以拍攝食物。' : '請允許相簿權限以選擇食物照片。',
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
