import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { Field, PrimaryButton, Screen, Title } from '@/components/ui';
import { safeReturnTo } from '@/navigation/return-to';

export default function Login() {
  const { signIn } = useSession();
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
      Alert.alert('登入失敗', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-6 pt-16">
        <Title sub="每天照著流程走,把好習慣養起來。">每日減脂計畫</Title>

        <View className="gap-3">
          <PrimaryButton tone="dark" onPress={() => Alert.alert('尚未設定', 'Apple 登入需要 development build 與 Apple 開發者帳號。')}>
            使用 Apple 繼續
          </PrimaryButton>
          <PrimaryButton tone="plain" onPress={() => Alert.alert('尚未設定', 'Google 登入需要 development build 與三組 Client ID。')}>
            使用 Google 繼續
          </PrimaryButton>
        </View>

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line" />
          <Text className="text-sm text-muted">或使用 Email</Text>
          <View className="h-px flex-1 bg-line" />
        </View>

        <View className="gap-3">
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="密碼"
            value={password}
            onChangeText={setPassword}
            placeholder="至少 8 個字"
            secureTextEntry
            textContentType="password"
          />
          <Text className="text-right text-sm text-primary underline">忘記密碼</Text>
        </View>

        <PrimaryButton onPress={submit} disabled={busy || !email || !password}>
          {busy ? '登入中…' : '登入'}
        </PrimaryButton>

        <Text className="text-center text-base text-muted">
          還沒有帳號?{' '}
          <Link href={{ pathname: '/register', params: { returnTo } }} className="text-primary underline">
            註冊新帳號
          </Link>
        </Text>

        <Text className="text-center text-sm text-muted">
          第一次用 Apple 或 Google 登入時會自動建立帳號,接著填寫個人資料。
        </Text>
      </View>
    </Screen>
  );
}
