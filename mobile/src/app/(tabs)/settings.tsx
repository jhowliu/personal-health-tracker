import { Pressable, Text } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { ChoiceRow, NumberRow } from '@/components/ProfileRows';
import { ReminderRow } from '@/components/ReminderRow';
import { TimezoneRow } from '@/components/TimezoneRow';
import { Card, PrimaryButton, Row, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { todayISO } from '@/dates';
import { syncWeighInReminder } from '@/notifications/reminder';

const SEX_OPTIONS = [
  { value: 'f' as const, label: '女' },
  { value: 'm' as const, label: '男' },
];
const ACTIVITY_OPTIONS = [
  { value: 'sedentary' as const, label: '久坐' },
  { value: 'light' as const, label: '常走動' },
  { value: 'moderate' as const, label: '勞力工作' },
  { value: 'active' as const, label: '粗重勞力' },
];
const DEFICIT_OPTIONS = ([10, 12, 15, 20] as const).map((value) => ({ value, label: `少吃 ${value}%` }));
// Where the workout sits in the day's flow: after breakfast, or between lunch and dinner.
const WORKOUT_TIME_OPTIONS = [
  { value: 'am' as const, label: '早上練（早餐後）' },
  { value: 'pm' as const, label: '晚上練（晚餐前）' },
];

export default function SettingsScreen() {
  const { profile, signOut, reload } = useSession();

  if (!profile) return null;
  const { profile: me, targets } = profile;

  const age = new Date().getFullYear() - Number(me.birth_date.slice(0, 4));

  const saveReminder = async (next: string | null) => {
    try {
      await api.patch('/users/me/reminders', { reminder_time: next });
      await reload();
      const result = await syncWeighInReminder(next, { askPermission: next !== null });
      if (result === 'denied') {
        Alert.alert('通知沒有開', '請到手機的系統設定，允許這個 App 傳送通知，提醒才會響。');
      }
    } catch (error) {
      Alert.alert('改不了', error instanceof ApiError ? error.message : '請稍後再試');
    }
  };

  const patchProfile = async (changes: Schema<'ProfilePatch'>) => {
    try {
      await api.patch('/users/me/profile', changes);
      await reload();
    } catch (error) {
      Alert.alert('改不了', error instanceof ApiError ? error.message : '請稍後再試');
    }
  };

  const saveTimezone = (timezone: string) => patchProfile({ timezone });

  // A day takes the profile's workout time when it is first opened, so today is moved along
  // with it; otherwise the change would only show tomorrow. Earlier days keep theirs.
  const saveWorkoutTime = async (workout_time: 'am' | 'pm') => {
    try {
      await api.patch('/users/me/profile', { workout_time });
      await api.patch(`/days/${todayISO()}`, { workout_time });
      await reload();
    } catch (error) {
      Alert.alert('改不了', error instanceof ApiError ? error.message : '請稍後再試');
    }
  };

  const confirmDelete = () =>
    Alert.alert('刪除帳號', '所有紀錄會一起刪掉，無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/users/me');
          } finally {
            await signOut();
          }
        },
      },
    ]);

  return (
    <Screen footerSafeArea={false}>
      <Title>設定</Title>

      <SectionHeading>個人資料</SectionHeading>
      <Card className="py-0">
        <Rows>
          <ChoiceRow
            label="性別"
            value={me.sex}
            options={SEX_OPTIONS}
            onSave={(sex) => patchProfile({ sex })}
          />
          <NumberRow
            label="年齡"
            unit="歲"
            value={age}
            min={10}
            max={100}
            onSave={(years) => patchProfile({ birth_date: `${new Date().getFullYear() - years}-01-01` })}
          />
          <NumberRow
            label="身高"
            unit="cm"
            value={me.height_cm}
            min={100}
            max={250}
            decimal
            onSave={(height_cm) => patchProfile({ height_cm })}
          />
          <NumberRow
            label="體重"
            unit="kg"
            value={me.weight_kg}
            min={30}
            max={300}
            decimal
            onSave={(weight_kg) => patchProfile({ weight_kg })}
          />
          <ChoiceRow
            label="日常活動量（不含運動）"
            value={me.activity_level}
            options={ACTIVITY_OPTIONS}
            onSave={(activity_level) => patchProfile({ activity_level })}
          />
          <ChoiceRow
            label="減脂速度"
            value={me.deficit_pct}
            options={DEFICIT_OPTIONS}
            onSave={(deficit_pct) => patchProfile({ deficit_pct })}
          />
        </Rows>
      </Card>

      <SectionHeading>每日目標</SectionHeading>
      <Card className="py-0">
        <Rows>
          <Row label="熱量（不含運動）" value={`${targets.kcal.toLocaleString()} 大卡`} />
          <Row label="蛋白質" value={`${targets.protein_g} g`} />
          <Row label="脂肪" value={`${targets.fat_g} g`} />
          <Row label="碳水" value={`${targets.carb_g} g`} />
          <Row label="基礎代謝" value={`${targets.bmr.toLocaleString()} 大卡`} />
          <Row label="日常總消耗" value={`${targets.tdee.toLocaleString()} 大卡`} />
        </Rows>
      </Card>

      <SectionHeading>偏好</SectionHeading>
      <Card className="py-0">
        <Rows>
          <ChoiceRow
            label="訓練時段"
            value={me.workout_time}
            options={WORKOUT_TIME_OPTIONS}
            onSave={saveWorkoutTime}
          />
          <Row label="常用地點" value={me.default_location === 'gym' ? '健身房' : '在家'} />
          <TimezoneRow value={me.timezone} onSave={saveTimezone} />
          <ReminderRow value={me.reminder_time} onSave={saveReminder} />
        </Rows>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        className="min-h-[52px] items-center justify-center rounded-field border border-line bg-surface"
      >
        <Text className="text-base font-semibold text-ink">登出</Text>
      </Pressable>

      <PrimaryButton tone="danger" onPress={confirmDelete}>
        刪除帳號
      </PrimaryButton>
    </Screen>
  );
}
