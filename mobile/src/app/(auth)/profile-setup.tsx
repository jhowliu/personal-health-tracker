import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Card, Field, Hint, PrimaryButton, Screen, Segmented, Title } from '@/components/ui';

type Targets = Schema<'TargetsOut'>;
type Sex = 'f' | 'm';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active';
type Deficit = 10 | 12 | 15 | 20;

const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentary: '久坐,幾乎不運動',
  light: '每週運動 1–3 天',
  moderate: '每週運動 3–5 天',
  active: '每週運動 6–7 天',
};

const DEFICIT_LABEL: Record<Deficit, string> = {
  10: '慢慢來(少吃 10%)',
  12: '穩定(少吃 12%)',
  15: '積極(少吃 15%)',
  20: '最快(少吃 20%)',
};

const TIMEZONE = 'Asia/Taipei';

export default function ProfileSetup() {
  const { reload } = useSession();

  const [sex, setSex] = useState<Sex>('f');
  const [age, setAge] = useState('31');
  const [height, setHeight] = useState('164');
  const [weight, setWeight] = useState('56');
  const [waist, setWaist] = useState('');
  const [activity, setActivity] = useState<Activity>('sedentary');
  const [deficit, setDeficit] = useState<Deficit>(12);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [busy, setBusy] = useState(false);

  const payload = useMemo(() => {
    const years = Number(age);
    const height_cm = Number(height);
    const weight_kg = Number(weight);
    if (!years || !height_cm || !weight_kg) return null;

    const birthYear = new Date().getFullYear() - years;
    return {
      sex,
      birth_date: `${birthYear}-01-01`,
      height_cm,
      weight_kg,
      activity_level: activity,
      deficit_pct: deficit,
      timezone: TIMEZONE,
    };
  }, [sex, age, height, weight, activity, deficit]);

  useEffect(() => {
    if (!payload) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const preview = await api.post('/users/me/targets/preview', payload);
        if (live) setTargets(preview);
      } catch {
        if (live) setTargets(null);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [payload]);

  const submit = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      await api.put('/users/me/profile', payload);
      if (waist) {
        const today = new Date().toISOString().slice(0, 10);
        await api.put(`/body-logs/${today}`, {
          weight_kg: payload.weight_kg,
          waist_cm: Number(waist),
        });
      }
      await reload();
      router.replace('/today');
    } catch (error) {
      Alert.alert('存不起來', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-5 pt-4">
        <Title sub="用來計算每天的熱量和營養素目標">建立你的資料</Title>

        <View className="gap-1">
          <Text className="text-sm text-muted">性別</Text>
          <View className="w-40">
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { value: 'f', label: '女' },
                { value: 'm', label: '男' },
              ]}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <Field label="年齡" suffix="歲" value={age} onChangeText={setAge} keyboardType="numeric" />
          <Field label="身高" suffix="cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
        </View>

        <View className="flex-row gap-3">
          <Field label="體重" suffix="kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <Field
            label="腰圍(選填)"
            suffix="cm"
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
          />
        </View>

        <Picker
          label="平常活動量"
          value={activity}
          labels={ACTIVITY_LABEL}
          onChange={setActivity}
        />
        <Picker label="減脂速度" value={deficit} labels={DEFICIT_LABEL} onChange={setDeficit} />

        <TargetPreview targets={payload ? targets : null} />

        <PrimaryButton onPress={submit} disabled={busy || !payload}>
          {busy ? '儲存中…' : '開始使用'}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

function Picker<T extends string | number>({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const keys = Object.keys(labels) as unknown as T[];
  const normalise = (key: T) => (typeof value === 'number' ? (Number(key) as T) : key);

  return (
    <View className="gap-1">
      <Text className="text-sm text-muted">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {keys.map((key) => {
          const option = normalise(key);
          const active = option === value;
          return (
            <Text
              key={String(key)}
              onPress={() => onChange(option)}
              className={`overflow-hidden rounded-field px-3 py-3 text-base ${
                active ? 'bg-ink font-semibold text-white' : 'border border-line bg-surface text-ink'
              }`}
            >
              {labels[key]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function TargetPreview({ targets }: { targets: Targets | null }) {
  if (!targets) {
    return (
      <Card>
        <Hint>填完年齡、身高和體重就會算出每日目標。</Hint>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <Text className="text-sm text-muted">你的每日目標</Text>
      <Text className="font-display text-4xl font-bold text-ink">
        {targets.kcal.toLocaleString()} <Text className="text-base font-normal text-muted">大卡</Text>
      </Text>

      <View className="flex-row gap-2">
        <Macro value={`${targets.protein_g} g`} label="蛋白質" box="bg-primary-soft" text="text-primary" />
        <Macro value={`${targets.fat_g} g`} label="脂肪" box="bg-warm-soft" text="text-warm" />
        <Macro value={`${targets.carb_g} g`} label="碳水" box="bg-good-soft" text="text-good" />
      </View>

      <Hint>
        基礎代謝 {targets.bmr.toLocaleString()} 大卡,每日總消耗 {targets.tdee.toLocaleString()} 大卡
      </Hint>
    </Card>
  );
}

function Macro({ value, label, box, text }: { value: string; label: string; box: string; text: string }) {
  return (
    <View className={`flex-1 items-center gap-0.5 rounded-field py-3 ${box}`}>
      <Text className={`text-base font-bold ${text}`}>{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
