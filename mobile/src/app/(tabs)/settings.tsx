import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { ApiError, api } from '@/api/client';
import { useSession } from '@/auth/session';
import { Card, Hint, Row, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { color } from '@/theme/tokens';

const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: '久坐',
  light: '每週 1–3 天',
  moderate: '每週 3–5 天',
  active: '每週 6–7 天',
};

export default function SettingsScreen() {
  const { profile, signOut, reload } = useSession();
  const [busy, setBusy] = useState(false);

  if (!profile) return null;
  const { profile: me, targets } = profile;

  const age = new Date().getFullYear() - Number(me.birth_date.slice(0, 4));

  const toggleAutoCarbs = async (next: boolean) => {
    setBusy(true);
    try {
      await api.patch('/users/me/profile', { auto_scale_carbs: next });
      await reload();
    } catch (error) {
      Alert.alert('改不了', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('刪除帳號', '所有紀錄會一起刪掉,無法復原。', [
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

      <SectionHeading action={<Text className="text-base text-primary">編輯</Text>}>
        個人資料
      </SectionHeading>
      <Card className="py-0">
        <Rows>
          <Row label="性別" value={me.sex === 'f' ? '女' : '男'} />
          <Row label="年齡" value={`${age} 歲`} />
          <Row label="身高" value={`${me.height_cm} cm`} />
          <Row label="體重" value={`${me.weight_kg} kg`} />
          <Row label="平常活動量" value={ACTIVITY_LABEL[me.activity_level] ?? me.activity_level} />
          <Row label="減脂速度" value={`少吃 ${me.deficit_pct}%`} />
        </Rows>
      </Card>

      <SectionHeading>每日目標</SectionHeading>
      <Card className="py-0">
        <Rows>
          <Row label="熱量" value={`${targets.kcal.toLocaleString()} 大卡`} />
          <Row label="蛋白質" value={`${targets.protein_g} g`} />
          <Row label="脂肪" value={`${targets.fat_g} g`} />
          <Row label="碳水" value={`${targets.carb_g} g`} />
          <Row label="基礎代謝" value={`${targets.bmr.toLocaleString()} 大卡`} />
          <Row label="每日總消耗" value={`${targets.tdee.toLocaleString()} 大卡`} />
        </Rows>
      </Card>

      <SectionHeading>偏好</SectionHeading>
      <Card className="py-0">
        <Rows>
          <Row label="運動時間預設" value={me.workout_time === 'am' ? '早餐後' : '晚餐前'} />
          <Row label="常用地點" value={me.default_location === 'gym' ? '健身房' : '在家'} />
          <Row label="早上提醒量體重" value={me.reminder_time ?? '不提醒'} />
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 gap-0.5 pr-4">
              <Text className="text-base text-ink">主食份量自動調整</Text>
              <Hint>熱量目標改變時,自動增減主食份量。蛋白質和蔬菜不變。</Hint>
            </View>
            <Switch
              value={me.auto_scale_carbs}
              onValueChange={toggleAutoCarbs}
              disabled={busy}
              trackColor={{ true: color.good, false: color.line }}
            />
          </View>
        </Rows>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        className="min-h-[52px] items-center justify-center rounded-field border border-line bg-surface"
      >
        <Text className="text-base font-semibold text-ink">登出</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={confirmDelete}
        className="min-h-[52px] items-center justify-center rounded-field border border-line bg-surface"
      >
        <Text className="text-base text-primary">刪除帳號</Text>
      </Pressable>
    </Screen>
  );
}
