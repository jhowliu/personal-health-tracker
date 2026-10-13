import { Pressable } from 'react-native';

import { PrivacySettings } from '@/ai/PrivacySettings';
import { ApiError, api, type Schema } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { LogOutIcon, TrashIcon } from '@/components/icons';
import { ChoiceRow, NumberRow } from '@/components/ProfileRows';
import { ReminderRow } from '@/components/ReminderRow';
import { Text } from '@/components/text';
import { TimezoneRow } from '@/components/TimezoneRow';
import { Card, Row, Rows, Screen, SectionHeading, Title } from '@/components/ui';
import { todayISO } from '@/dates';
import type { LocalePreference } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { useI18n } from '@/i18n/runtime';
import { syncWeighInReminder } from '@/notifications/reminder';
import { color } from '@/theme/tokens';

export default function SettingsScreen() {
  const { profile, signOut, reload } = useSession();
  const { preference, setPreference, t } = useI18n();

  if (!profile) return null;
  const { profile: me, targets } = profile;

  const age = new Date().getFullYear() - Number(me.birth_date.slice(0, 4));
  const sexOptions = [
    { value: 'f' as const, label: t('common.labels.female') },
    { value: 'm' as const, label: t('common.labels.male') },
  ];
  const activityOptions = [
    { value: 'sedentary' as const, label: t('profileSetup.activity.sedentary') },
    { value: 'light' as const, label: t('profileSetup.activity.light') },
    { value: 'moderate' as const, label: t('profileSetup.activity.moderate') },
    { value: 'active' as const, label: t('profileSetup.activity.active') },
  ];
  const deficitOptions = ([10, 12, 15, 20] as const).map((value) => ({
    value,
    label: t('settings.calorieDeficit', { value }),
  }));
  const workoutTimeOptions = [
    { value: 'am' as const, label: t('settings.workoutMorning') },
    { value: 'pm' as const, label: t('settings.workoutEvening') },
  ];
  const languageOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('settings.languageSystem') },
    { value: 'zh-TW', label: t('settings.languageTraditionalChinese') },
    { value: 'en', label: t('settings.languageEnglish') },
  ];

  const saveReminder = async (next: string | null) => {
    try {
      await api.patch('/users/me/reminders', { reminder_time: next });
      await reload();
      const result = await syncWeighInReminder(next, { askPermission: next !== null });
      if (result === 'denied') {
        Alert.alert(t('settings.notificationsDisabled'), t('settings.notificationsDisabledBody'));
      }
    } catch (error) {
      Alert.alert(
        t('settings.changeFailed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
    }
  };

  const patchProfile = async (changes: Schema<'ProfilePatch'>) => {
    try {
      await api.patch('/users/me/profile', changes);
      await reload();
    } catch (error) {
      Alert.alert(
        t('settings.changeFailed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
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
      Alert.alert(
        t('settings.changeFailed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
    }
  };

  const saveLanguage = async (next: LocalePreference) => {
    try {
      await setPreference(next);
      await syncWeighInReminder(me.reminder_time);
    } catch {
      Alert.alert(t('settings.changeFailed'), t('common.errors.tryAgain'));
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountBody'), [
      { text: t('common.actions.cancel'), style: 'cancel' },
      {
        text: t('common.actions.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/users/me');
          } catch (error) {
            // The account is still there (its photos go first), so stay signed in to try again.
            // An expired session cannot be helped from here: sign out as before.
            if (!(error instanceof ApiError) || error.status !== 401) {
              Alert.alert(
                t('settings.deleteAccountFailed'),
                error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
              );
              return;
            }
          }
          await signOut();
        },
      },
    ]);

  return (
    <Screen footerSafeArea={false}>
      <Title>{t('settings.title')}</Title>

      <SectionHeading>{t('settings.personalDetails')}</SectionHeading>
      <Card className="py-0">
        <Rows>
          <ChoiceRow
            label={t('common.labels.sex')}
            value={me.sex}
            options={sexOptions}
            onSave={(sex) => patchProfile({ sex })}
          />
          <NumberRow
            label={t('common.labels.age')}
            unit={t('common.units.year')}
            value={age}
            min={10}
            max={100}
            onSave={(years) => patchProfile({ birth_date: `${new Date().getFullYear() - years}-01-01` })}
          />
          <NumberRow
            label={t('common.labels.height')}
            unit={t('common.units.centimeter')}
            value={me.height_cm}
            min={100}
            max={250}
            decimal
            onSave={(height_cm) => patchProfile({ height_cm })}
          />
          <NumberRow
            label={t('common.labels.weight')}
            unit={t('common.units.kilogram')}
            value={me.weight_kg}
            min={30}
            max={300}
            decimal
            onSave={(weight_kg) => patchProfile({ weight_kg })}
          />
          <ChoiceRow
            label={t('settings.activityLevel')}
            value={me.activity_level}
            options={activityOptions}
            onSave={(activity_level) => patchProfile({ activity_level })}
          />
          <ChoiceRow
            label={t('settings.deficitSpeed')}
            value={me.deficit_pct}
            options={deficitOptions}
            onSave={(deficit_pct) => patchProfile({ deficit_pct })}
          />
        </Rows>
      </Card>

      <SectionHeading action={<Text className="text-xs text-muted">{t('settings.excludesExercise')}</Text>}>
        {t('settings.dailyTargets')}
      </SectionHeading>
      <Card className="py-0">
        <Rows>
          <Row label={t('common.labels.calories')} value={`${formatNumber(targets.kcal)} ${t('common.units.kcal')}`} />
          <Row label={t('common.labels.protein')} value={`${targets.protein_g} ${t('common.units.gram')}`} />
          <Row label={t('common.labels.fat')} value={`${targets.fat_g} ${t('common.units.gram')}`} />
          <Row label={t('common.labels.carbs')} value={`${targets.carb_g} ${t('common.units.gram')}`} />
          <Row label={t('settings.basalMetabolicRate')} value={`${formatNumber(targets.bmr)} ${t('common.units.kcal')}`} />
          <Row label={t('settings.dailyExpenditure')} value={`${formatNumber(targets.tdee)} ${t('common.units.kcal')}`} />
        </Rows>
      </Card>

      <SectionHeading>{t('settings.preferences')}</SectionHeading>
      <Card className="py-0">
        <Rows>
          <ChoiceRow
            label={t('settings.workoutTime')}
            value={me.workout_time}
            options={workoutTimeOptions}
            onSave={saveWorkoutTime}
          />
          <Row
            label={t('settings.defaultLocation')}
            value={t(me.default_location === 'gym' ? 'common.locations.gym' : 'common.locations.home')}
          />
          <TimezoneRow value={me.timezone} onSave={saveTimezone} />
          <ReminderRow value={me.reminder_time} onSave={saveReminder} />
          <ChoiceRow
            label={t('settings.language')}
            value={preference}
            options={languageOptions}
            onSave={saveLanguage}
          />
        </Rows>
      </Card>

      <PrivacySettings />

      <SectionHeading>{t('settings.account')}</SectionHeading>
      <Card className="py-0">
        <Rows>
          <Pressable
            accessibilityRole="button"
            onPress={signOut}
            className="min-h-[52px] flex-row items-center justify-between py-3 active:opacity-70"
          >
            <Text className="text-base text-ink">{t('settings.signOut')}</Text>
            <LogOutIcon size={18} tint={color.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            className="min-h-[52px] flex-row items-center justify-between py-3 active:opacity-70"
          >
            <Text className="text-base text-danger">{t('settings.deleteAccount')}</Text>
            <TrashIcon size={18} tint={color.danger} />
          </Pressable>
        </Rows>
      </Card>
    </Screen>
  );
}
