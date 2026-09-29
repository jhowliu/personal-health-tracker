/**
 * Keeps the phone's reminder schedule in step with the account. Renders nothing; mount it
 * once inside SessionProvider.
 *
 * It re-syncs when the reminder time changes and whenever the app comes to the front, which
 * is what tops the schedule up and drops today's reminder once the weigh-in is logged.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/auth/session';

import { cancelWeighInReminder, syncWeighInReminder } from './reminder';

export function ReminderSync() {
  const { status, profile } = useSession();
  const time = profile?.profile.reminder_time ?? null;

  useEffect(() => {
    if (status === 'signedOut') {
      // The next person to sign in on this phone must not inherit this reminder.
      void cancelWeighInReminder().catch(() => {});
      return;
    }
    if (status !== 'ready') return;

    const sync = () => void syncWeighInReminder(time).catch(() => {});
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => subscription.remove();
  }, [status, time]);

  return null;
}
