import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/auth/route-gates';

export default function WorkoutsLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
