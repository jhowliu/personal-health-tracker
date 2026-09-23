import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useSession } from '@/auth/session';
import { Field, Hint, PrimaryButton, Screen, Title } from '@/components/ui';

export default function Register() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signIn('/auth/register', { email, password });
      router.replace('/');
    } catch (error) {
      Alert.alert('註冊失敗', error instanceof ApiError ? error.message : '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-6 pt-16">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text className="text-base text-primary">‹ 返回</Text>
        </Pressable>

        <Title sub="建立帳號後,下一步填個人資料算出每日目標。">註冊新帳號</Title>

        <View className="gap-3">
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="密碼"
            value={password}
            onChangeText={setPassword}
            placeholder="至少 8 個字"
            secureTextEntry
          />
          <Hint>密碼至少 8 個字。</Hint>
        </View>

        <PrimaryButton onPress={submit} disabled={busy || password.length < 8 || !email}>
          {busy ? '建立中…' : '建立帳號'}
        </PrimaryButton>
      </View>
    </Screen>
  );
}
