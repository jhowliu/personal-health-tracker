/** The 隱私 section of 設定: the AI analysis switch and the privacy policy. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { ensureAiConsent, readAiConsent, setAiConsent } from '@/ai/consent';
import { Alert } from '@/components/alert';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Rows, SectionHeading } from '@/components/ui';
import { color } from '@/theme/tokens';

export function PrivacySettings() {
  // null until read; the switch waits for it rather than showing a guess.
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      readAiConsent()
        .then((given) => {
          if (live) setConsent(given);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      // Turning it on goes through the same sheet as first use, so it is never agreed to
      // without seeing what is sent.
      setConsent(on ? await ensureAiConsent() : await setAiConsent(false));
    } catch {
      Alert.alert('無法儲存設定', '請稍後再試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeading>隱私</SectionHeading>
      <Card className="py-0">
        <Rows>
          <View className="min-h-[52px] flex-row items-center justify-between gap-3 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-base text-ink">AI 分析</Text>
              <Text className="text-sm text-muted">拍照辨識與週報建議</Text>
            </View>
            <Switch
              accessibilityLabel="AI 分析"
              value={consent ?? false}
              disabled={consent === null || busy}
              onValueChange={toggle}
              trackColor={{ true: color.primary, false: color.line }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/privacy')}
            className="min-h-[52px] flex-row items-center justify-between py-3 active:opacity-70"
          >
            <Text className="text-base text-ink">隱私權政策</Text>
            <ChevronIcon direction="right" size={16} tint={color.muted} />
          </Pressable>
        </Rows>
      </Card>
    </>
  );
}
