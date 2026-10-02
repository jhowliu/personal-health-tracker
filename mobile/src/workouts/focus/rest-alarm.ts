/**
 * The 休息結束 alarm (spec §5): a local notification for when the phone is put away, and a
 * buzz when the app is on screen. No notification handler is set anywhere in the app, so a
 * notification arriving in the foreground stays silent and the screen does the telling.
 *
 * One rest at a time per date, so the request uses a fixed identifier: scheduling again
 * replaces the old one, and cancelling needs nothing stored.
 */
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL = 'rest-timer';
const identifier = (date: string) => `focus-rest:${date}`;
const supported = Platform.OS !== 'web';

/** Asked on 開始訓練. Without it focus mode still works: it counts down and buzzes on screen. */
export async function ensureRestAlarmPermission(): Promise<boolean> {
  if (!supported) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

export async function scheduleRestAlarm(date: string, endsAt: number, body: string): Promise<void> {
  if (!supported) return;
  const seconds = Math.ceil((endsAt - Date.now()) / 1000);
  if (seconds < 1) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: '休息結束提醒',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: identifier(date),
      content: { title: '休息結束', body, sound: true, data: { kind: 'focus-rest' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: CHANNEL,
      },
    });
  } catch {
    // The on-screen countdown still ends the rest; only the background alert is missing.
  }
}

export async function cancelRestAlarm(date: string): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier(date));
  } catch {
    // Already fired or never scheduled.
  }
}

/** The on-screen counterpart of the notification: one buzz when a rest or a timer ends. */
export function buzz(): void {
  if (!supported) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
