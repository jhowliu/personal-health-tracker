import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { ProtectedRoute } from '@/auth/route-gates';
import { useSession } from '@/auth/session';
import { CalendarCheckIcon, DumbbellIcon, ScaleIcon, SlidersIcon, UtensilsIcon } from '@/components/icons';
import { registerPushToken } from '@/notifications/push';
import { color } from '@/theme/tokens';

const TABS = [
  { name: 'today', title: '今天', icon: CalendarCheckIcon },
  { name: 'body', title: '身形', icon: ScaleIcon },
  { name: 'meals', title: '餐點', icon: UtensilsIcon },
  { name: 'workouts', title: '訓練', icon: DumbbellIcon },
  { name: 'settings', title: '設定', icon: SlidersIcon },
] as const;

export default function TabsLayout() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'ready') registerPushToken();
  }, [status]);

  return (
    <ProtectedRoute>
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
              tabBarIcon: ({ focused }) => <tab.icon tint={focused ? color.primary : color.muted} size={24} />,
            }}
          />
        ))}
      </Tabs>
    </ProtectedRoute>
  );
}
