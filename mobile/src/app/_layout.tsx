import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/auth/session';
import { NumericDoneBar } from '@/components/NumericDoneBar';
import { draft } from '@/meals/draft';
import { ReminderSync } from '@/notifications/ReminderSync';
import { color } from '@/theme/tokens';
import { photoDraft } from '@/meals/photo-draft';
import { replacement } from '@/workouts/replacement';

function clearUserState() {
  draft.clearAll();
  photoDraft.clearAll();
  replacement.clear();
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider onSignedOut={clearUserState}>
          <StatusBar style="dark" />
          <ReminderSync />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
          <NumericDoneBar />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
