import '../../global.css';

import { Huninn_400Regular, useFonts } from '@expo-google-fonts/huninn';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AiConsentHost } from '@/ai/consent';
import { SessionProvider } from '@/auth/session';
import { AlertHost } from '@/components/alert';
import { NumericDoneBar } from '@/components/NumericDoneBar';
import { PhoneFrame } from '@/components/PhoneFrame';
import { draft } from '@/meals/draft';
import { ReminderSync } from '@/notifications/ReminderSync';
import { color } from '@/theme/tokens';
import { photoDraft } from '@/meals/photo-draft';
import { stepCache } from '@/today/step-cache';
import { replacement } from '@/workouts/replacement';

function clearUserState() {
  draft.clearAll();
  photoDraft.clearAll();
  stepCache.clearAll();
  replacement.clear();
}

export default function RootLayout() {
  // Every Text names this face; drawing before it loads would flash the system font.
  const [fontsLoaded] = useFonts({ Huninn_400Regular });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PhoneFrame>
        <SafeAreaProvider>
          <SessionProvider onSignedOut={clearUserState}>
            <StatusBar style="dark" />
            <ReminderSync />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
            <NumericDoneBar />
            <AiConsentHost />
            <AlertHost />
          </SessionProvider>
        </SafeAreaProvider>
      </PhoneFrame>
    </GestureHandlerRootView>
  );
}
