import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/auth/route-gates';

export default function ProgressLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
