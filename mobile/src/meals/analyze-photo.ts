import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { api } from '@/api/client';
import type { PhotoAnalysis } from '@/meals/photo-draft';

type PhotoCreate = { id: string; upload_url: string };

export async function analyzeMealPhoto(
  uri: string,
  width: number,
  height: number,
): Promise<PhotoAnalysis> {
  const resized = await manipulateAsync(
    uri,
    [{ resize: width >= height ? { width: 1024 } : { height: 1024 } }],
    { compress: 0.8, format: SaveFormat.JPEG },
  );
  const photo: PhotoCreate = await api.post('/meal-photos', { content_type: 'image/jpeg' });
  const upload = await FileSystem.uploadAsync(photo.upload_url, resized.uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`照片上傳失敗 (${upload.status})，請確認網路後再試。`);
  }
  return api.post(`/meal-photos/${photo.id}/analyze`);
}
