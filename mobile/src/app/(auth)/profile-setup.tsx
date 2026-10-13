import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { Card, Field, Hint, PrimaryButton, Screen, Segmented, Title } from '@/components/ui';
import { safeReturnTo } from '@/navigation/return-to';
import { deviceTimezone } from '@/timezone';
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';

type Targets = Schema<'TargetsOut'>;
type Sex = 'f' | 'm';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active';
type Deficit = 10 | 12 | 15 | 20;

export default function ProfileSetup() {
  const { reload, profile: existing } = useSession();
  const { t } = useI18n();
  // A new account starts on the phone's own zone; editing keeps whatever was chosen.
  const timezone = existing?.profile.timezone ?? deviceTimezone();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();

  const [sex, setSex] = useState<Sex>('f');
  // Left empty on purpose: a pre-filled age or weight looks real and gets accepted unread.
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [activity, setActivity] = useState<Activity>('sedentary');
  const [deficit, setDeficit] = useState<Deficit>(12);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [busy, setBusy] = useState(false);
  // Daily life only: the day's workout is added to the target on its own.
  const activityLabels: Record<Activity, string> = {
    sedentary: t('profileSetup.activity.sedentary'),
    light: t('profileSetup.activity.light'),
    moderate: t('profileSetup.activity.moderate'),
    active: t('profileSetup.activity.active'),
  };
  const deficitLabels: Record<Deficit, string> = {
    10: t('profileSetup.deficit.slow'),
    12: t('profileSetup.deficit.steady'),
    15: t('profileSetup.deficit.active'),
    20: t('profileSetup.deficit.fastest'),
  };

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
      timezone,
    };
  }, [sex, age, height, weight, activity, deficit, timezone]);

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
      router.replace(safeReturnTo(returnTo));
    } catch (error) {
      Alert.alert(
        t('profileSetup.saveFailed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View className="flex-row items-center gap-3">
          {payload && targets ? (
            <View>
              <Text className="text-xs text-muted">{t('profileSetup.dailyTarget')}</Text>
              <Text className="text-lg text-ink">
                {formatNumber(targets.kcal)}{' '}
                <Text className="text-xs text-muted">{t('common.units.kcal')}</Text>
              </Text>
            </View>
          ) : null}
          <View className="flex-1">
            <PrimaryButton onPress={submit} disabled={!payload} busy={busy}>
              {busy ? t('profileSetup.saving') : t('profileSetup.startUsing')}
            </PrimaryButton>
          </View>
        </View>
      }
    >
      <View className="gap-5 pt-4">
        <Title sub={t('profileSetup.subtitle')}>{t('profileSetup.title')}</Title>

        <View className="gap-1">
          <Text className="text-sm text-muted">{t('common.labels.sex')}</Text>
          <View className="w-40">
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { value: 'f', label: t('common.labels.female') },
                { value: 'm', label: t('common.labels.male') },
              ]}
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <Field
            label={t('common.labels.age')}
            suffix={t('common.units.year')}
            value={age}
            onChangeText={setAge}
            placeholder={t('profileSetup.agePlaceholder')}
            keyboardType="numeric"
          />
          <Field
            label={t('common.labels.height')}
            suffix={t('common.units.centimeter')}
            value={height}
            onChangeText={setHeight}
            placeholder={t('profileSetup.heightPlaceholder')}
            keyboardType="decimal-pad"
          />
        </View>

        <View className="flex-row gap-3">
          <Field
            label={t('common.labels.weight')}
            suffix={t('common.units.kilogram')}
            value={weight}
            onChangeText={setWeight}
            placeholder={t('profileSetup.weightPlaceholder')}
            keyboardType="decimal-pad"
          />
          <Field
            label={t('profileSetup.waistOptional')}
            suffix={t('common.units.centimeter')}
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
          />
        </View>

        <Picker
          label={t('profileSetup.activityLevel')}
          value={activity}
          labels={activityLabels}
          onChange={setActivity}
        />
        <Picker
          label={t('profileSetup.deficitSpeed')}
          value={deficit}
          labels={deficitLabels}
          onChange={setDeficit}
        />

        <TargetPreview targets={payload ? targets : null} />
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
            <Pressable
              key={String(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option)}
              className={`min-h-[44px] justify-center overflow-hidden rounded-control border-[1.5px] px-3 ${
                active ? 'border-edge bg-primary-soft' : 'border-line bg-surface'
              }`}
            >
              <Text className={`text-base ${active ? 'text-primary' : 'text-ink'}`}>
                {labels[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TargetPreview({ targets }: { targets: Targets | null }) {
  const { t } = useI18n();
  if (!targets) {
    return (
      <Card>
        <Hint>{t('profileSetup.incompleteHint')}</Hint>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <Text className="text-sm text-muted">{t('profileSetup.yourDailyTarget')}</Text>
      <Text className="text-[28px] text-ink">
        {formatNumber(targets.kcal)}{' '}
        <Text className="text-sm text-muted">{t('common.units.kcal')}</Text>
      </Text>

      <View className="flex-row gap-2">
        <Macro value={`${targets.protein_g} ${t('common.units.gram')}`} label={t('common.labels.protein')} box="bg-primary-soft" text="text-primary" />
        <Macro value={`${targets.fat_g} ${t('common.units.gram')}`} label={t('common.labels.fat')} box="bg-warm-soft" text="text-warm" />
        <Macro value={`${targets.carb_g} ${t('common.units.gram')}`} label={t('common.labels.carbs')} box="bg-good-soft" text="text-good" />
      </View>

      <Hint>
        {t('profileSetup.targetExplanation', {
          bmr: formatNumber(targets.bmr),
          tdee: formatNumber(targets.tdee),
        })}
      </Hint>
    </Card>
  );
}

function Macro({ value, label, box, text }: { value: string; label: string; box: string; text: string }) {
  return (
    <View className={`flex-1 items-center gap-0.5 rounded-field py-3 ${box}`}>
      <Text className={`text-base ${text}`}>{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
