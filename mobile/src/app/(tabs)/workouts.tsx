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
import { formatDate } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
import { translate } from '@/i18n/translator';
import { color } from '@/theme/tokens';
import { workoutCategory } from '@/workouts/category';

type Template = Schema<'TemplateOut'>;
type ScheduleEntry = Schema<'ScheduleEntryOut'>;

export default function WorkoutsScreen() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekdayNames = [
    t('common.weekdays.monday'),
    t('common.weekdays.tuesday'),
    t('common.weekdays.wednesday'),
    t('common.weekdays.thursday'),
    t('common.weekdays.friday'),
    t('common.weekdays.saturday'),
    t('common.weekdays.sunday'),
  ];
  const weekdayLabels = [
    t('common.weekdays.abbreviatedMonday'),
    t('common.weekdays.abbreviatedTuesday'),
    t('common.weekdays.abbreviatedWednesday'),
    t('common.weekdays.abbreviatedThursday'),
    t('common.weekdays.abbreviatedFriday'),
    t('common.weekdays.abbreviatedSaturday'),
    t('common.weekdays.abbreviatedSunday'),
  ];

  const load = useCallback(async () => {
    try {
      const [list, plan] = await Promise.all([
        api.get('/workout-templates'),
        api.get('/workout-schedule'),
      ]);
      setTemplates(list);
      setSchedule(plan);
    } catch (error) {
      Alert.alert(t('workouts.home.loadFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    }
  }, [t]);

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
      Alert.alert(t('workouts.home.scheduleSaveFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
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
      Alert.alert(t('workouts.home.copyFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
    } finally {
      setWorkingId(null);
    }
  };

  const removeTemplate = (template: Template) => {
    // The schedule points at its templates, so a scheduled one cannot go until it is replaced.
    const days = schedule
      .filter((entry) => entry.template_id === template.id)
      .map((entry) => weekdayNames[entry.weekday]);
    if (days.length > 0) {
      Alert.alert(
        t('workouts.home.templateScheduledTitle'),
        t('workouts.home.templateScheduledBody', { name: template.name, days: days.join(', ') }),
      );
      return;
    }

    Alert.alert(t('workouts.home.deleteTemplateTitle'), t('workouts.home.deleteTemplateBody', { name: template.name }), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('common.actions.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setWorkingId(template.id);
            try {
              await api.delete(`/workout-templates/${template.id}`);
              setTemplates((current) => current?.filter((item) => item.id !== template.id) ?? current);
              setExpandedId((current) => (current === template.id ? null : current));
            } catch (error) {
              Alert.alert(t('common.errors.deleteFailed'), error instanceof ApiError ? error.message : t('common.errors.tryAgain'));
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
        <Title
          action={
            <HeaderAddButton label={t('common.actions.create')} accessibilityLabel={t('workouts.home.addTemplate')} onPress={() => router.navigate('/workouts/new')} />
          }
        >
          {t('workouts.home.title')}
        </Title>
      }
    >
      <SectionHeading action={<Text className="text-xs text-muted">{weekRange()}</Text>}>
        {t('workouts.home.weeklySchedule')}
      </SectionHeading>
      {templates.length === 0 ? (
        <Hint>{t('workouts.home.scheduleNeedsTemplate')}</Hint>
      ) : null}
      <Card className="px-0 py-0">
        <Rows>
          {weekdayLabels.map((label, weekday) => {
            const entry = schedule.find((item) => item.weekday === weekday);
            const template = entry ? byId.get(entry.template_id) : undefined;
            const category = template ? workoutCategory(template.category_id) : undefined;
            const open = editingDay === weekday;
            const isToday = weekday === thisWeekday;

            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={t('workouts.home.changeDayTemplate', {
                  day: weekdayNames[weekday],
                  name: template?.name ?? t('workouts.home.restDay'),
                })}
                accessibilityState={{ expanded: open }}
                disabled={busy}
                onPress={() => setEditingDay(open ? null : weekday)}
                className={`min-h-[52px] flex-row items-center gap-3 px-4 py-3 ${isToday ? 'bg-primary-soft' : ''} ${
                  busy ? 'opacity-40' : ''
                }`}
              >
                <Text className="w-9 text-sm text-muted">{label}</Text>
                <Text className="flex-1 text-[15px] text-ink">{template?.name ?? t('workouts.home.restDay')}</Text>
                {isToday ? (
                  <View className="rounded-full border-[1.5px] border-edge px-2 py-0.5">
                    <Text className="text-xs text-ink">{t('common.labels.today')}</Text>
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

      <SectionHeading action={<Text className="text-xs text-muted">{t(ownedTemplates.length === 1 ? 'common.counts.templates.one' : 'common.counts.templates.other', { count: ownedTemplates.length })}</Text>}>
        {t('workouts.home.myTemplates')}
      </SectionHeading>
      {ownedTemplates.length === 0 ? (
        <Empty compact sticker="dumbbell">{t('workouts.home.noOwnedTemplates')}</Empty>
      ) : (
        <View className="gap-3">{ownedTemplates.map(renderTemplate)}</View>
      )}

      {builtinTemplates.length > 0 ? (
        <>
          <SectionHeading action={<Text className="text-xs text-muted">{t(builtinTemplates.length === 1 ? 'common.counts.templates.one' : 'common.counts.templates.other', { count: builtinTemplates.length })}</Text>}>
            {t('workouts.home.publicTemplates')}
          </SectionHeading>
          <View className="gap-3">{builtinTemplates.map(renderTemplate)}</View>
        </>
      ) : null}

      <Sheet
        visible={editingDay !== null}
        title={editingDay === null ? '' : weekdayNames[editingDay]}
        onClose={() => {
          if (!busy) setEditingDay(null);
        }}
      >
        <Hint>{t('workouts.home.currentTemplate', { name: editingTemplate?.name ?? t('workouts.home.restDay') })}</Hint>
        <ScrollView contentContainerClassName="gap-2 pb-4" keyboardShouldPersistTaps="handled">
          <ChoiceOption
            label={t('workouts.home.restDay')}
            selected={!editingEntry}
            disabled={busy || editingDay === null}
            onPress={() => editingDay !== null && assign(editingDay, null)}
          />
          {templates.map((option) => (
            <ChoiceOption
              key={option.id}
              label={option.name}
              detail={`${option.is_builtin ? t('workouts.home.publicPrefix') : ''}${describe(option)}`}
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
  const short = (day: Date) => formatDate(day, { month: 'numeric', day: 'numeric' });
  return `${short(monday)} – ${short(sunday)}`;
}

function describe(template: Template): string {
  const minutes = template.duration_min
    ? translate('workouts.home.approximateMinutes', { count: template.duration_min })
    : '';
  return translate('workouts.home.summary', { count: template.items.length, minutes });
}
