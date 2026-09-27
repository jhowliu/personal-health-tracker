import { Redirect, useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useSession } from '@/auth/session';
import { PrimaryButton } from '@/components/ui';
import { safeReturnTo } from '@/navigation/return-to';
import { color } from '@/theme/tokens';

function SessionPending() {
  const { status, reload, signOut } = useSession();
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg px-6">
      <Text className="text-center text-base text-muted">目前連不上服務，登入資料仍保留在這台裝置。</Text>
      <View className="w-full">
        <PrimaryButton onPress={() => void reload().catch(() => {})}>重新連線</PrimaryButton>
      </View>
      <View className="w-full">
        <PrimaryButton tone="plain" onPress={() => void signOut()}>
          登出
        </PrimaryButton>
      </View>
    </View>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const returnTo = pathWithSearch(pathname, params);
  if (status === 'loading' || status === 'unavailable') return <SessionPending />;
  if (status === 'signedOut') {
    return <Redirect href={{ pathname: '/login', params: { returnTo } }} />;
  }
  if (status === 'newUser') {
    return <Redirect href={{ pathname: '/profile-setup', params: { returnTo } }} />;
  }
  return children;
}

function pathWithSearch(pathname: string, params: Record<string, string | string[]>) {
  const pathSegments = pathname.split('/').map((segment) => decodeURIComponent(segment));
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key === 'returnTo') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (!pathSegments.includes(value)) search.append(key, value);
    }
  }
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function AuthRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  if (status === 'loading' || status === 'unavailable') return <SessionPending />;
  if (status === 'ready') return <Redirect href={safeReturnTo(returnTo)} />;
  if (status === 'newUser' && pathname !== '/profile-setup') {
    return <Redirect href={{ pathname: '/profile-setup', params: { returnTo } }} />;
  }
  if (status === 'signedOut' && pathname === '/profile-setup') {
    return <Redirect href={{ pathname: '/login', params: { returnTo } }} />;
  }
  return children;
}
