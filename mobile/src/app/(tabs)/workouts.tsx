import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Card, Chip, Empty, Screen, Segmented, SectionHeading, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

type Template = Schema<'TemplateOut'>;
type ScheduleEntry = Schema<'ScheduleEntryOut'>;

const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
const CATEGORY_TONE = {
  strength: { label: '肌力', tone: 'primary' as const },
  cardio: { label: '有氧', tone: 'good' as const },
  mobility: { label: '伸展', tone: 'neutral' as const },
};

export default function WorkoutsScreen() {
  const [location, setLocation] = useState<'home' | 'gym'>('gym');
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const [list, plan] = await Promise.all([
        api.get(`/workout-templates?location=${location}`),
        api.get('/workout-schedule'),
      ]);
      setTemplates(list);
      setSchedule(plan);
    } catch (error) {
      Alert.alert('讀不到訓練資料', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, [location]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!templates) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const byId = new Map(templates.map((t) => [t.id, t]));
  const forLocation = schedule.filter((entry) => entry.location === location);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>訓練</Title>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/workouts/new')}
          className="min-h-[44px] justify-center rounded-field bg-primary px-4"
        >
          <Text className="text-base font-semibold text-white">+ 新增課表</Text>
        </Pressable>
      </View>

      <Segmented
        value={location}
        onChange={setLocation}
        tone="soft"
        options={[
          { value: 'home', label: '在家' },
          { value: 'gym', label: '健身房' },
        ]}
      />

      <SectionHeading>一週排程</SectionHeading>
      <Card className="py-0">
        {WEEKDAYS.map((label, index) => {
          const entry = forLocation.find((e) => e.weekday === index);
          const template = entry ? byId.get(entry.template_id) : undefined;
          const category = template ? CATEGORY_TONE[template.category_id as keyof typeof CATEGORY_TONE] : undefined;

          return (
            <View
              key={label}
              className="flex-row items-center justify-between border-b border-line py-3 last:border-b-0"
            >
              <View className="gap-0.5">
                <Text className="text-base font-semibold text-ink">{label}</Text>
                <Text className="text-sm text-muted">{template?.name ?? '休息日'}</Text>
              </View>
              <Chip label={category?.label ?? '休息'} tone={category?.tone ?? 'neutral'} />
            </View>
          );
        })}
      </Card>

      <SectionHeading>課表</SectionHeading>
      {templates.length === 0 ? (
        <Empty>還沒有{location === 'gym' ? '健身房' : '在家'}的課表</Empty>
      ) : (
        <Card className="py-0">
          {templates.map((template) => (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              onPress={() => router.push(`/workouts/${template.id}`)}
              className="min-h-[44px] flex-row items-center justify-between border-b border-line py-3 last:border-b-0"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold text-ink">{template.name}</Text>
                <Text className="text-sm text-muted">
                  {template.items.length} 個動作
                  {template.duration_min ? `,約 ${template.duration_min} 分鐘` : ''}
                </Text>
              </View>
              <Text className="text-base text-primary">編輯</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
