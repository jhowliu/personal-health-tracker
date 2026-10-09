import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { Alert } from '@/components/alert';
import { ChevronIcon } from '@/components/icons';
import { ChoiceOption, Sheet } from '@/components/Sheet';
import { TemplateCard } from '@/components/TemplateCard';
import { Text } from '@/components/text';
import { Card, Empty, HeaderAddButton, Hint, Rows, Screen, SectionHeading, Tag, Title } from '@/components/ui';
import { color } from '@/theme/tokens';
import { workoutCategory } from '@/workouts/category';

type Template = Schema<'TemplateOut'>;
type ScheduleEntry = Schema<'ScheduleEntryOut'>;

const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

export default function WorkoutsScreen() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
      setEditingDay((current) => (current === weekday ? null : current));
    } catch (error) {
      Alert.alert('排程存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  // A copy is the only way to change a built-in template, so it opens straight into editing.
  const copyTemplate = async (template: Template) => {
    setWorkingId(template.id);
    try {
      const copied: Template = await api.post(`/workout-templates/${template.id}/copy`);
      router.navigate(`/workouts/${copied.id}`);
    } catch (error) {
      Alert.alert('複製不了課表', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setWorkingId(null);
    }
  };

  const removeTemplate = (template: Template) => {
    // The schedule points at its templates, so a scheduled one cannot go until it is replaced.
    const days = schedule
      .filter((entry) => entry.template_id === template.id)
      .map((entry) => WEEKDAYS[entry.weekday]);
    if (days.length > 0) {
      Alert.alert(
        '這份課表還在排程裡',
        `「${template.name}」排在${days.join('、')}。先到一週排程改成休息日或別的課表，才能刪除。`,
      );
      return;
    }

    Alert.alert('刪除課表', `確定刪除「${template.name}」？刪除後無法復原。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setWorkingId(template.id);
            try {
              await api.delete(`/workout-templates/${template.id}`);
              setTemplates((current) => current?.filter((item) => item.id !== template.id) ?? current);
              setExpandedId((current) => (current === template.id ? null : current));
            } catch (error) {
              Alert.alert('刪除失敗', error instanceof ApiError ? error.message : '請稍後再試');
            } finally {
              setWorkingId(null);
            }
          })();
        },
      },
    ]);
  };

  if (!templates) {
    return (
      <Screen scroll={false} footerSafeArea={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={color.primary} />
        </View>
      </Screen>
    );
  }

  const byId = new Map(templates.map((template) => [template.id, template]));
  const builtinTemplates = templates.filter((template) => template.is_builtin);
  const ownedTemplates = templates.filter((template) => !template.is_builtin);
  const editingEntry = schedule.find((item) => item.weekday === editingDay);
  const editingTemplate = editingEntry ? byId.get(editingEntry.template_id) : undefined;
  const thisWeekday = todayWeekday();

  const renderTemplate = (template: Template) => (
    <TemplateCard
      key={template.id}
      template={template}
      expanded={expandedId === template.id}
      busy={workingId === template.id}
      onToggle={() => setExpandedId((current) => (current === template.id ? null : template.id))}
      onOpen={() => router.navigate(`/workouts/${template.id}`)}
      onCopy={() => copyTemplate(template)}
      onDelete={() => removeTemplate(template)}
    />
  );

  return (
    <Screen
      footerSafeArea={false}
      pinnedHeader={
        <View className="flex-row items-center justify-between">
          <Title>訓練</Title>
          <HeaderAddButton label="新增" accessibilityLabel="新增課表" onPress={() => router.navigate('/workouts/new')} />
        </View>
      }
    >
      <SectionHeading action={<Text className="text-xs text-muted">{weekRange()}</Text>}>一週排程</SectionHeading>
      {templates.length === 0 ? (
        <Hint>先新增一份課表，才排得進星期幾。</Hint>
      ) : null}
      <Card className="px-0 py-0">
        <Rows>
          {WEEKDAYS.map((label, weekday) => {
            const entry = schedule.find((item) => item.weekday === weekday);
            const template = entry ? byId.get(entry.template_id) : undefined;
            const category = template ? workoutCategory(template.category_id) : undefined;
            const open = editingDay === weekday;
            const isToday = weekday === thisWeekday;

            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`更改${label}的課表，目前${template?.name ?? '休息日'}`}
                accessibilityState={{ expanded: open }}
                disabled={busy}
                onPress={() => setEditingDay(open ? null : weekday)}
                className={`min-h-[52px] flex-row items-center gap-3 px-4 py-3 ${isToday ? 'bg-primary-soft' : ''} ${
                  busy ? 'opacity-40' : ''
                }`}
              >
                <Text className="w-9 text-sm text-muted">{label}</Text>
                <Text className="flex-1 text-[15px] text-ink">{template?.name ?? '休息日'}</Text>
                {isToday ? (
                  <View className="rounded-full border-[1.5px] border-edge px-2 py-0.5">
                    <Text className="text-xs text-ink">今天</Text>
                  </View>
                ) : category ? (
                  <Tag label={category.label} tone={category.tone} />
                ) : null}
                <ChevronIcon direction="right" size={15} tint={color.ink} />
              </Pressable>
            );
          })}
        </Rows>
      </Card>

      <SectionHeading action={<Text className="text-xs text-muted">{ownedTemplates.length} 份</Text>}>
        我的課表
      </SectionHeading>
      {ownedTemplates.length === 0 ? (
        <Empty compact>還沒有自己的課表，可新增或從公用課表複製</Empty>
      ) : (
        <View className="gap-3">{ownedTemplates.map(renderTemplate)}</View>
      )}

      {builtinTemplates.length > 0 ? (
        <>
          <SectionHeading action={<Text className="text-xs text-muted">{builtinTemplates.length} 份</Text>}>
            公用課表
          </SectionHeading>
          <View className="gap-3">{builtinTemplates.map(renderTemplate)}</View>
        </>
      ) : null}

      <Sheet
        visible={editingDay !== null}
        title={editingDay === null ? '' : WEEKDAYS[editingDay]}
        onClose={() => {
          if (!busy) setEditingDay(null);
        }}
      >
        <Hint>目前：{editingTemplate?.name ?? '休息日'}</Hint>
        <ScrollView contentContainerClassName="gap-2 pb-4" keyboardShouldPersistTaps="handled">
          <ChoiceOption
            label="休息日"
            selected={!editingEntry}
            disabled={busy || editingDay === null}
            onPress={() => editingDay !== null && assign(editingDay, null)}
          />
          {templates.map((option) => (
            <ChoiceOption
              key={option.id}
              label={option.name}
              detail={`${option.is_builtin ? '公用 · ' : ''}${describe(option)}`}
              selected={editingEntry?.template_id === option.id}
              disabled={busy || editingDay === null}
              onPress={() => editingDay !== null && assign(editingDay, option.id)}
            />
          ))}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}

/** Today on the schedule's Monday-first week: Monday is 0. */
function todayWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

/** "10/5 — 10/11": this week, Monday to Sunday. */
function weekRange(): string {
  const monday = new Date();
  monday.setDate(monday.getDate() - todayWeekday());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const short = (day: Date) => `${day.getMonth() + 1}/${day.getDate()}`;
  return `${short(monday)} — ${short(sunday)}`;
}

function describe(template: Template): string {
  const minutes = template.duration_min ? `，約 ${template.duration_min} 分鐘` : '';
  return `${template.items.length} 個動作${minutes}`;
}
