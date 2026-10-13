import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { Alert } from '@/components/alert';
import { Text } from '@/components/text';
import { Field, PrimaryButton, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { safeReturnTo } from '@/navigation/return-to';

export default function Login() {
  const { signIn } = useSession();
  const { t } = useI18n();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signIn('/auth/login', { email, password });
      router.replace(safeReturnTo(returnTo));
    } catch (error) {
      Alert.alert(
        t('auth.login.failed'),
        error instanceof ApiError ? error.message : t('common.errors.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-6 pt-16">
        <Title sub={t('common.tagline')}>{t('auth.login.title')}</Title>

        <View className="gap-3">
          <PrimaryButton
            tone="dark"
            onPress={() => Alert.alert(t('auth.login.notConfigured'), t('auth.login.appleUnavailable'))}
          >
            {t('auth.login.continueWithApple')}
          </PrimaryButton>
          <PrimaryButton
            tone="plain"
            onPress={() => Alert.alert(t('auth.login.notConfigured'), t('auth.login.googleUnavailable'))}
          >
            {t('auth.login.continueWithGoogle')}
          </PrimaryButton>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line" />
          <Text className="text-sm text-muted">{t('auth.login.emailDivider')}</Text>
          <View className="h-px flex-1 bg-line" />
        </View>

        <View className="gap-3">
          <Field
            label={t('common.labels.email')}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label={t('common.labels.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.register.passwordPlaceholder')}
            secureTextEntry
            textContentType="password"
          />
          <Text className="text-right text-sm text-primary underline">
            {t('auth.login.forgotPassword')}
          </Text>
        </View>

        <PrimaryButton onPress={submit} disabled={busy || !email || !password}>
          {busy ? t('auth.login.signingIn') : t('auth.login.action')}
        </PrimaryButton>

        <Text className="text-center text-base text-muted">
          {t('auth.login.noAccount')}{' '}
          <Link href={{ pathname: '/register', params: { returnTo } }} className="text-primary underline">
            {t('auth.login.register')}
          </Link>
        </Text>

        <Text className="text-center text-sm text-muted">
          {t('auth.login.socialFirstUse')}
        </Text>
      </View>
    </Screen>
  );
}
