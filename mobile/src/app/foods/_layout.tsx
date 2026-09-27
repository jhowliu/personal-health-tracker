import { Stack } from 'expo-router';

import { ProtectedRoute } from '@/auth/route-gates';

export default function FoodsLayout() {
  return (
    <ProtectedRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </ProtectedRoute>
  );
}
