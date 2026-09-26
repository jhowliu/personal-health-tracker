import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/auth/route-gates';

export default function MealsLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
