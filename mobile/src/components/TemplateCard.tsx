/** A workout template that expands in place to show its exercises and actions. */
import { View } from 'react-native';

import type { Schema } from '@/api/client';
import { ExpandableCard } from '@/components/ExpandableCard';
import { CopyIcon, EyeIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Tag } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { workoutCategory } from '@/workouts/category';
import { ExerciseFigure } from '@/workouts/figure/ExerciseFigure';
import { formatPrescription } from '@/workouts/prescription';

type Template = Schema<'TemplateOut'>;

export function TemplateCard({
  template,
  expanded,
  busy,
  onToggle,
  onOpen,
  onCopy,
  onDelete,
}: {
  template: Template;
  expanded: boolean;
  busy?: boolean;
  onToggle: () => void;
  /** Edit an own template, or view a built-in one. */
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const category = workoutCategory(template.category_id);
  const gym = template.location === 'gym';
  const summary = template.items.map((item) => item.exercise_name).join('・');
  const count = t(template.items.length === 1 ? 'common.counts.exercises.one' : 'common.counts.exercises.other', {
    count: template.items.length,
  });

  return (
    <ExpandableCard
      name={template.name}
      expanded={expanded}
      busy={busy}
      onToggle={onToggle}
      summary={
        <>
          {/* Same scale as a meal card: 15 px name, the number in ink with a small unit. */}
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="flex-1 text-[15px] text-ink">{template.name}</Text>
            {template.duration_min ? (
              <Text className="text-sm text-ink">
                {template.duration_min}
                <Text className="text-xs text-muted"> {t('common.units.minute')}</Text>
              </Text>
            ) : (
              <Text className="text-xs text-muted">{count}</Text>
            )}
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {category ? <Tag label={category.label} tone={category.tone} /> : null}
            <Tag label={gym ? t('common.locations.gym') : t('common.locations.home')} tone={gym ? 'good' : 'warm'} />
          </View>

          <Text className="text-xs text-muted" numberOfLines={1}>
            {summary || t('workouts.templateCard.noExercises')}
          </Text>
        </>
      }
      details={template.items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <View className="h-px bg-line" /> : null}
          <View className="flex-row items-center gap-3 py-2">
            <ExerciseFigure exerciseId={item.exercise_id} name={item.exercise_name} mode="single" />
            <Text className="flex-1 text-sm text-ink">{item.exercise_name}</Text>
            <Text className="text-sm text-muted">{formatPrescription(item)}</Text>
          </View>
        </View>
      ))}
      actions={
        template.is_builtin
          ? [
              {
                label: t('workouts.templateCard.viewTemplate'),
                accessibilityLabel: t('common.accessibility.viewNamed', { name: template.name }),
                icon: EyeIcon,
                onPress: onOpen,
              },
              {
                label: t('workouts.templateCard.copyCustomize'),
                accessibilityLabel: t('workouts.templateCard.copyCustomize'),
                icon: CopyIcon,
                onPress: onCopy,
              },
            ]
          : [
              {
                label: t('workouts.templateCard.editTemplate'),
                accessibilityLabel: t('common.accessibility.editNamed', { name: template.name }),
                icon: PencilIcon,
                onPress: onOpen,
              },
              {
                label: t('common.actions.delete'),
                accessibilityLabel: t('common.accessibility.deleteNamed', { name: template.name }),
                icon: TrashIcon,
                onPress: onDelete,
                tone: 'danger',
              },
            ]
      }
    />
  );
}
