import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProtectedRoute } from '@/auth/route-gates';
import { useSession } from '@/auth/session';
import { CalendarCheckIcon, DumbbellIcon, ScaleIcon, SlidersIcon, UtensilsIcon } from '@/components/icons';
import { FONT_FAMILY } from '@/components/text';
import { registerPushToken } from '@/notifications/push';
import { color } from '@/theme/tokens';

const TABS = [
  { name: 'today', title: '今天', icon: CalendarCheckIcon },
  { name: 'body', title: '進度', icon: ScaleIcon },
  { name: 'meals', title: '餐點', icon: UtensilsIcon },
  { name: 'workouts', title: '訓練', icon: DumbbellIcon },
  { name: 'settings', title: '設定', icon: SlidersIcon },
] as const;

export default function TabsLayout() {
  const { status } = useSession();
  const insets = useSafeAreaInsets();

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
          // The selected tab sits on a soft berry pill under a dark rule, like the rest of the journal.
          tabBarActiveBackgroundColor: color.primarySoft,
          // Taller than the default so the pill has room around the icon and its label.
          tabBarStyle: {
            backgroundColor: color.bg,
            borderTopColor: color.edge,
            borderTopWidth: 2,
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 6, marginVertical: 6, overflow: 'hidden' },
          tabBarLabelStyle: { fontFamily: FONT_FAMILY, fontSize: 12 },
          sceneStyle: { backgroundColor: color.bg },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ focused }) => <tab.icon tint={focused ? color.primary : color.muted} size={21} />,
            }}
          />
        ))}
      </Tabs>
    </ProtectedRoute>
  );
}
