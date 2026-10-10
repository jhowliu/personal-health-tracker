/**
 * Consent to AI analysis, asked the first time an AI feature is used rather than at sign-up,
 * since the app works without it. One consent covers both features: meal-photo recognition
 * and the weekly report's advice. It can be withdrawn in 設定.
 *
 * `ensureAiConsent()` resolves true once the user has agreed, asking with a sheet when they
 * have not; AiConsentHost, mounted once in the root layout, draws that sheet.
 */
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { api } from '@/api/client';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/text';
import { PrimaryButton, TextAction } from '@/components/ui';

export async function readAiConsent(): Promise<boolean> {
  return (await api.get('/users/me/ai-consent')).consent;
}

export async function setAiConsent(consent: boolean): Promise<boolean> {
  return (await api.put('/users/me/ai-consent', { consent })).consent;
}

/**
 * What is sent, to whom, and how to stop it; the sheet and the weekly report both show it.
 * `onPolicy` opens the privacy policy; the caller first closes whatever modal it is in.
 */
export function AiConsentText({ onPolicy }: { onPolicy: () => void }) {
  return (
    <View className="gap-2">
      <Text className="text-base text-ink">
        AI 分析會把以下資料傳給 Anthropic 的 Claude 處理：
      </Text>
      <Text className="text-sm text-muted">・拍照辨識時：餐點照片</Text>
      <Text className="text-sm text-muted">
        ・週報建議時：這週的飲食、訓練、體重與腰圍紀錄，以及性別、年齡、身高
      </Text>
      <Text className="text-sm text-muted">
        不會傳送 Email 或帳號資料。可以隨時在「設定」關閉。
      </Text>
      <TextAction label="隱私權政策" onPress={onPolicy} className="self-start" />
    </View>
  );
}

// Every caller waiting on the sheet gets the same answer.
let waiting: ((consent: boolean) => void)[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isAsking = () => waiting.length > 0;

/** True once the user has agreed, asking first when they have not. */
export async function ensureAiConsent(): Promise<boolean> {
  if (await readAiConsent()) return true;
  const consent = await new Promise<boolean>((resolve) => {
    waiting.push(resolve);
    notify();
  });
  // Let the sheet slide away first: iOS drops an alert presented while a modal is closing,
  // and the photo flow opens one next.
  if (consent) await new Promise((resolve) => setTimeout(resolve, 400));
  return consent;
}

function answer(consent: boolean) {
  const all = waiting;
  waiting = [];
  notify();
  all.forEach((resolve) => resolve(consent));
}

export function AiConsentHost() {
  const open = useSyncExternalStore(subscribe, isAsking, isAsking);

  const agree = async () => {
    try {
      answer(await setAiConsent(true));
    } catch {
      answer(false);
    }
  };

  return (
    <Sheet visible={open} title="使用 AI 分析" onClose={() => answer(false)}>
      <AiConsentText
        onPolicy={() => {
          answer(false);
          router.push('/privacy');
        }}
      />
      <PrimaryButton onPress={agree}>同意並繼續</PrimaryButton>
    </Sheet>
  );
}
