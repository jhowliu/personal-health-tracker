import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/auth/session';
import { registerPushToken } from '@/notifications/push';
import { color } from '@/theme/tokens';

const TABS = [
  { name: 'today', title: '今天' },
  { name: 'body', title: '身形' },
  { name: 'meals', title: '餐點' },
  { name: 'workouts', title: '訓練' },
  { name: 'settings', title: '設定' },
] as const;

export default function TabsLayout() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'ready') registerPushToken();
  }, [status]);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (status === 'newUser') return <Redirect href="/profile-setup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.line },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => <Dot focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

function Dot({ focused }: { focused: boolean }) {
  return (
    <View
      className={`h-4 w-4 items-center justify-center rounded-full border-2 ${
        focused ? 'border-primary' : 'border-muted'
      }`}
    >
      {focused ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
    </View>
  );
}
