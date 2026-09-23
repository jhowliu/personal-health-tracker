/**
 * 註冊推播,讓後端每天早上提醒量體重。
 *
 * 呼叫端只看到 registerPushToken():權限、Android 頻道、拿 Expo token、
 * 回報給 /devices 全包在裡面,失敗時安靜略過(沒有推播不影響其他功能)。
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/api/client';

const ANDROID_CHANNEL = 'weigh-in';

export async function registerPushToken(): Promise<boolean> {
  if (!Device.isDevice) return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: '每天早上提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#A3245F',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        })
      ).granted;
    if (!granted) return false;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/devices', {
      push_token: data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return true;
  } catch {
    return false;
  }
}
