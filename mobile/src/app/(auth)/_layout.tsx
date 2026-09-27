import { Stack } from 'expo-router';

import { AuthRoute } from '@/auth/route-gates';

export default function AuthLayout() {
  return (
    <AuthRoute>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthRoute>
  );
}
