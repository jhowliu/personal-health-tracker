import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Card, Chip, Empty, Hint, Rows, Screen, SectionHeading, Title } from '@/components/ui';
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
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, plan] = await Promise.all([
        api.get('/workout-templates'),
        api.get('/workout-schedule'),
      ]);
      setTemplates(list);
      setSchedule(plan);
    } catch (error) {
      Alert.alert('讀不到訓練資料', error instanceof ApiError ? error.message : '請稍後再試');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // The schedule is replaced whole, so send every other day back untouched alongside the
  // one that changed. A null template means the day is a rest day: it just goes missing.
  const assign = async (weekday: number, templateId: string | null) => {
    const next = schedule
      .filter((entry) => entry.weekday !== weekday)
      .map((entry) => ({ weekday: entry.weekday, template_id: entry.template_id }));
    if (templateId) next.push({ weekday, template_id: templateId });

    setBusy(true);
    try {
      setSchedule(await api.put('/workout-schedule', next));
      setEditingDay(null);
    } catch (error) {
      Alert.alert('排程存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  if (!templates) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const byId = new Map(templates.map((template) => [template.id, template]));

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

      <SectionHeading>一週排程</SectionHeading>
      {templates.length === 0 ? (
        <Hint>先新增一份課表,才排得進星期幾。</Hint>
      ) : null}
      <Card className="py-0">
        <Rows>
          {WEEKDAYS.map((label, weekday) => {
            const entry = schedule.find((item) => item.weekday === weekday);
            const template = entry ? byId.get(entry.template_id) : undefined;
            const category = template
              ? CATEGORY_TONE[template.category_id as keyof typeof CATEGORY_TONE]
              : undefined;
            const open = editingDay === weekday;

            return (
              <View key={label}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setEditingDay(open ? null : weekday)}
                  className="min-h-[44px] flex-row items-center justify-between gap-3 py-3"
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-semibold text-ink">{label}</Text>
                    <Text className="text-sm text-muted">{template?.name ?? '休息日'}</Text>
                  </View>
                  <Chip label={category?.label ?? '休息'} tone={category?.tone ?? 'neutral'} />
                  <Text className="text-base text-primary">{open ? '收起' : '更改'}</Text>
                </Pressable>

                {open ? (
                  <View className="gap-2 pb-3">
                    <ScheduleOption
                      label="休息日"
                      selected={!entry}
                      disabled={busy}
                      onPress={() => assign(weekday, null)}
                    />
                    {templates.map((option) => (
                      <ScheduleOption
                        key={option.id}
                        label={option.name}
                        detail={describe(option)}
                        selected={entry?.template_id === option.id}
                        disabled={busy}
                        onPress={() => assign(weekday, option.id)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Rows>
      </Card>

      <SectionHeading>課表</SectionHeading>
      {templates.length === 0 ? (
        <Empty>還沒有課表,按右上角新增一份</Empty>
      ) : (
        <Card className="py-0">
          <Rows>
            {templates.map((template) => (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                onPress={() => router.push(`/workouts/${template.id}`)}
                className="min-h-[44px] flex-row items-center justify-between gap-3 py-3"
              >
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-ink">{template.name}</Text>
                  <Text className="text-sm text-muted">{describe(template)}</Text>
                </View>
                <Chip
                  label={template.location === 'gym' ? '健身房' : '在家'}
                  tone={template.location === 'gym' ? 'primary' : 'neutral'}
                />
                <Text className="text-base text-primary">編輯</Text>
              </Pressable>
            ))}
          </Rows>
        </Card>
      )}
    </Screen>
  );
}

function ScheduleOption({
  label,
  detail,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-between gap-3 rounded-field px-3 py-2 ${
        selected ? 'bg-primary-soft' : 'bg-fill'
      }`}
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-ink">{label}</Text>
        {detail ? <Text className="text-sm text-muted">{detail}</Text> : null}
      </View>
      {selected ? <Text className="text-base text-primary">✓</Text> : null}
    </Pressable>
  );
}

function describe(template: Template): string {
  const minutes = template.duration_min ? `,約 ${template.duration_min} 分鐘` : '';
  return `${template.items.length} 個動作${minutes}`;
}
