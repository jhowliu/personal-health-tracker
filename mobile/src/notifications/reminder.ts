/**
 * The morning weigh-in reminder, scheduled on the phone itself.
 *
 * Callers see only syncWeighInReminder() and cancelWeighInReminder(). The reminder time
 * lives on the account (`reminder_time`), so signing in on another phone schedules it
 * there too. Nothing here needs a server push, an Apple developer account or a
 * development build: local notifications work in Expo Go.
 *
 * Calls are serialized. Two overlapping syncs would each cancel and then each schedule,
 * leaving the reminder duplicated.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, type Schema } from '@/api/client';
import { color } from '@/theme/tokens';

import { localDateISO, reminderDates } from './reminder-plan';

const KIND = 'weigh-in';
const CHANNEL = 'weigh-in';

export type ReminderResult = 'scheduled' | 'off' | 'denied';

let queue: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function cancelPending() {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((request) => request.content.data?.kind === KIND)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

async function allowed(askPermission: boolean) {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!askPermission || !existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

/** A failed lookup counts as "not logged", so an offline morning still gets its reminder. */
async function weighedInToday(): Promise<boolean> {
  try {
    const today: Schema<'TodayOut'> = await api.get(`/days/${localDateISO(new Date())}`);
    return today.flow.completed.includes('body');
  } catch {
    return false;
  }
}

/**
 * Make the phone's schedule match `time` ("HH:MM", or null for no reminder).
 *
 * `askPermission` is only for the moment the user turns the reminder on; every other call
 * leaves the permission prompt alone.
 */
export function syncWeighInReminder(
  time: string | null,
  { askPermission = false }: { askPermission?: boolean } = {},
): Promise<ReminderResult> {
  return serialized(async () => {
    await cancelPending();
    if (!time) return 'off';
    if (!(await allowed(askPermission))) return 'denied';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: '每天早上提醒',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: color.primary,
      });
    }

    const dates = reminderDates(new Date(), time, await weighedInToday());
    for (const date of dates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '早安，先量一下',
          body: '起床、上完廁所、還沒吃喝前量最準。',
          data: { kind: KIND },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: CHANNEL,
        },
      });
    }
    return 'scheduled';
  });
}

export function cancelWeighInReminder(): Promise<void> {
  return serialized(cancelPending);
}
