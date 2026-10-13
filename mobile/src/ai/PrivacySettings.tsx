/** The 隱私 section of 設定: the AI analysis switch and the privacy policy. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { ensureAiConsent, readAiConsent, setAiConsent } from '@/ai/consent';
import { Alert } from '@/components/alert';
import { ChevronIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Rows, SectionHeading } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';

export function PrivacySettings() {
  const { t } = useI18n();
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
      Alert.alert(t('privacy.saveFailed'), t('common.errors.tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeading>{t('privacy.settingsSection')}</SectionHeading>
      <Card className="py-0">
        <Rows>
          <View className="min-h-[52px] flex-row items-center justify-between gap-3 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-base text-ink">{t('privacy.aiAnalysis')}</Text>
              <Text className="text-sm text-muted">{t('privacy.aiAnalysisSummary')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('privacy.aiAnalysis')}
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
            <Text className="text-base text-ink">{t('privacy.policy')}</Text>
            <ChevronIcon direction="right" size={16} tint={color.muted} />
          </Pressable>
        </Rows>
      </Card>
    </>
  );
}
