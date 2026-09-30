/** A workout template that expands in place to show its exercises and actions. */
import { Text, View } from 'react-native';

import type { Schema } from '@/api/client';
import { ExpandableCard } from '@/components/ExpandableCard';
import { CopyIcon, EyeIcon, PencilIcon, TrashIcon } from '@/components/icons';
import { Tag } from '@/components/ui';
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
  const category = workoutCategory(template.category_id);
  const gym = template.location === 'gym';
  const summary = template.items.map((item) => item.exercise_name).join('・');
  const length = template.duration_min
    ? `${template.duration_min} 分鐘`
    : `${template.items.length} 個動作`;

  return (
    <ExpandableCard
      name={template.name}
      expanded={expanded}
      busy={busy}
      onToggle={onToggle}
      summary={
        <>
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="flex-1 text-base font-semibold text-ink">{template.name}</Text>
            <Text className="text-base text-muted">{length}</Text>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {category ? <Tag label={category.label} tone={category.tone} /> : null}
            <Tag label={gym ? '健身房' : '在家'} tone={gym ? 'primary' : 'neutral'} />
          </View>

          <Text className="text-sm text-muted" numberOfLines={1}>
            {summary || '還沒有動作'}
          </Text>
        </>
      }
      details={template.items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <View className="h-px bg-line" /> : null}
          <View className="flex-row items-center gap-3 py-2">
            <ExerciseFigure exerciseId={item.exercise_id} name={item.exercise_name} mode="single" />
            <Text className="flex-1 text-sm font-semibold text-ink">{item.exercise_name}</Text>
            <Text className="text-sm text-muted">{formatPrescription(item)}</Text>
          </View>
        </View>
      ))}
      actions={
        template.is_builtin
          ? [
              {
                label: '查看課表',
                accessibilityLabel: `查看${template.name}`,
                icon: EyeIcon,
                onPress: onOpen,
              },
              {
                label: '複製並自訂',
                accessibilityLabel: `複製${template.name}`,
                icon: CopyIcon,
                onPress: onCopy,
              },
            ]
          : [
              {
                label: '編輯課表',
                accessibilityLabel: `編輯${template.name}`,
                icon: PencilIcon,
                onPress: onOpen,
              },
              {
                label: '刪除',
                accessibilityLabel: `刪除${template.name}`,
                icon: TrashIcon,
                onPress: onDelete,
                tone: 'danger',
              },
            ]
      }
    />
  );
}
