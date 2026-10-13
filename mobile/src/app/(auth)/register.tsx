import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { BackLink, Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { backOrReplace } from '@/navigation/back';
import { safeReturnTo } from '@/navigation/return-to';

export default function Register() {
  const { signIn } = useSession();
  const { locale, t } = useI18n();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signIn('/auth/register', { email, password, locale });
      router.replace(safeReturnTo(returnTo));
    } catch (error) {
      Alert.alert(
        t('auth.register.failed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-6 pt-16">
        <BackLink
          label={t('auth.register.backToLogin')}
          onPress={() => backOrReplace({ pathname: '/login', params: { returnTo } })}
        />

        <Title sub={t('auth.register.subtitle')}>{t('auth.register.title')}</Title>

        <View className="gap-3">
          <Field
            label={t('common.labels.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label={t('common.labels.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.register.passwordPlaceholder')}
            secureTextEntry
          />
          <Hint>{t('auth.register.passwordHint')}</Hint>
        </View>

        <PrimaryButton onPress={submit} disabled={busy || password.length < 8 || !email}>
          {busy ? t('auth.register.creating') : t('auth.register.action')}
        </PrimaryButton>

        <Text className="text-center text-sm text-muted">
          {t('auth.register.agreementPrefix')}{' '}
          <Link href="/privacy" className="text-primary underline">
            {t('auth.register.privacyPolicy')}
          </Link>
        </Text>
      </View>
    </Screen>
  );
}
