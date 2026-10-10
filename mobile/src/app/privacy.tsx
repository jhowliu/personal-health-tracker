/**
 * The privacy policy: what is collected, what it is used for, what goes to the AI provider
 * and how to stop it. Open to everyone, signed in or not, since sign-up links here.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { BackLink, Card, Screen, SectionHeading, Title } from '@/components/ui';

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
  return (
    <Screen footerSafeArea={false}>
      <BackLink
        label="返回"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Title sub="最後更新：2026 年 10 月 10 日">隱私權政策</Title>

      <Section title="我們收集的資料">
        <Item>帳號：Email 與加密後的密碼。</Item>
        <Item>個人資料：性別、生日、身高、體重、活動量與時區，用來計算每日目標。</Item>
        <Item>每日紀錄：體重、腰圍、吃了什麼與份量、訓練紀錄。</Item>
        <Item>餐點照片：只有使用拍照辨識時才會上傳。</Item>
        <Item>裝置的推播代碼：用來傳送提醒通知。</Item>
      </Section>

      <Section title="資料的用途">
        <Para>
          只用來提供這個 App 的功能：計算每日目標、記錄與顯示進度、傳送提醒。不會用於廣告，也不會出售或提供給其他人，下面的 AI 分析除外。
        </Para>
      </Section>

      <Section title="AI 分析（需要你同意）">
        <Para>第一次使用 AI 功能時，會先請你同意：</Para>
        <Item>拍照辨識：餐點照片會傳給 Anthropic 的 Claude，辨識食物與份量。</Item>
        <Item>
          週報建議：那一週的飲食、訓練、體重與腰圍紀錄，以及性別、年齡、身高等計算目標用的資料，會傳給 Claude 產生建議。
        </Item>
        <Para>
          不會傳送 Email 或帳號資料。依 Anthropic 的商業服務條款，透過 API 傳送的資料預設不會用來訓練模型。你可以隨時在「設定 → AI 分析」關閉。
        </Para>
      </Section>

      <Section title="資料存放">
        <Para>
          紀錄存放在本服務的伺服器，餐點照片存放在雲端儲存空間，傳輸過程都經過加密（HTTPS）。
        </Para>
      </Section>

      <Section title="你的選擇">
        <Item>關閉 AI 分析：設定 → AI 分析。</Item>
        <Item>刪除帳號：設定 → 刪除帳號，會刪除帳號、所有紀錄與上傳過的餐點照片，無法復原。</Item>
      </Section>

      <Section title="聯絡我們">
        <Para>對隱私或資料有任何問題，請來信 {CONTACT_EMAIL}。</Para>
      </Section>
    </Screen>
  );
}
