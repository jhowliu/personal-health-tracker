import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProtectedRoute } from '@/auth/route-gates';
import { useSession } from '@/auth/session';
import { CalendarCheckIcon, DumbbellIcon, ScaleIcon, SlidersIcon, UtensilsIcon } from '@/components/icons';
import { FONT_FAMILY } from '@/components/text';
import { useI18n } from '@/i18n/runtime';
import { registerPushToken } from '@/notifications/push';
import { WeeklyReportHost } from '@/progress/weekly-popup';
import { color } from '@/theme/tokens';

export default function TabsLayout() {
  const { status } = useSession();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // Under 360 pt the pills give up some side margin so labels such as Workouts are not cut off.
  const narrow = useWindowDimensions().width < 360;
  const tabs = [
    { name: 'today', title: t('navigation.today'), icon: CalendarCheckIcon },
    { name: 'body', title: t('navigation.progress'), icon: ScaleIcon },
    { name: 'meals', title: t('navigation.meals'), icon: UtensilsIcon },
    { name: 'workouts', title: t('navigation.workouts'), icon: DumbbellIcon },
    { name: 'settings', title: t('navigation.settings'), icon: SlidersIcon },
  ] as const;

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
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: narrow ? 2 : 6, marginVertical: 6, overflow: 'hidden' },
          tabBarLabelStyle: { fontFamily: FONT_FAMILY, fontSize: narrow ? 11 : 12 },
          sceneStyle: { backgroundColor: color.bg },
        }}
      >
        {tabs.map((tab) => (
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
      <WeeklyReportHost />
    </ProtectedRoute>
  );
}
