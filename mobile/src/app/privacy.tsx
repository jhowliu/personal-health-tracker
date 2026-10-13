/**
 * The privacy policy: what is collected, what it is used for, what goes to the AI provider
 * and how to stop it. Open to everyone, signed in or not, since sign-up links here.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { BackLink, Card, Screen, SectionHeading, Title } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';

const CONTACT_EMAIL = 'jhowliu@gmail.com';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <SectionHeading>{title}</SectionHeading>
      <Card className="gap-2">{children}</Card>
    </View>
  );
}

function Para({ children }: { children: ReactNode }) {
  return <Text className="text-base leading-6 text-ink">{children}</Text>;
}

function Item({ children }: { children: ReactNode }) {
  return <Text className="text-base leading-6 text-ink">・{children}</Text>;
}

export default function PrivacyPolicy() {
  const { t } = useI18n();
  return (
    <Screen footerSafeArea={false}>
      <BackLink
        label={t('common.actions.back')}
        accessibilityLabel={t('common.actions.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Title sub={t('privacy.page.updated')}>{t('privacy.policy')}</Title>

      <Section title={t('privacy.page.collectedTitle')}>
        <Item>{t('privacy.page.accountData')}</Item>
        <Item>{t('privacy.page.profileData')}</Item>
        <Item>{t('privacy.page.dailyData')}</Item>
        <Item>{t('privacy.page.photoData')}</Item>
        <Item>{t('privacy.page.pushData')}</Item>
      </Section>

      <Section title={t('privacy.page.usesTitle')}>
        <Para>{t('privacy.page.usesBody')}</Para>
      </Section>

      <Section title={t('privacy.page.aiTitle')}>
        <Para>{t('privacy.page.aiIntro')}</Para>
        <Item>{t('privacy.page.aiPhoto')}</Item>
        <Item>{t('privacy.page.aiWeekly')}</Item>
        <Para>{t('privacy.page.aiTerms')}</Para>
      </Section>

      <Section title={t('privacy.page.storageTitle')}>
        <Para>{t('privacy.page.storageBody')}</Para>
      </Section>

      <Section title={t('privacy.page.choicesTitle')}>
        <Item>{t('privacy.page.disableAi')}</Item>
        <Item>{t('privacy.page.deleteAccount')}</Item>
      </Section>

      <Section title={t('privacy.page.contactTitle')}>
        <Para>{t('privacy.page.contactBody', { email: CONTACT_EMAIL })}</Para>
      </Section>
    </Screen>
  );
}
