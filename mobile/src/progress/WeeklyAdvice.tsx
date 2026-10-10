/**
 * The AI's part under a week's numbers: a look back at the week, then one thing to do next
 * week for eating, training and the body. Asked for the first time the report is read
 * and kept by the server, so opening it again is instant. Until the user agrees to AI
 * analysis this space asks for that instead.
 */
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AiConsentText, setAiConsent } from '@/ai/consent';
import { ApiError, api, type Schema } from '@/api/client';
import { DumbbellIcon, ScaleIcon, UtensilsIcon, type IconProps } from '@/components/icons';
import { Text } from '@/components/text';
import { PrimaryButton, TextAction } from '@/components/ui';
import { color } from '@/theme/tokens';

type Advice = Schema<'WeeklyAdviceOut'>;
type State =
  | { kind: 'loading' }
  | { kind: 'ready'; advice: Advice }
  | { kind: 'consent' }
  | { kind: 'failed'; message: string }
  // A week with nothing logged has nothing to advise on.
  | { kind: 'none' };

const LINES: { key: 'diet' | 'training' | 'body'; label: string; icon: ComponentType<IconProps> }[] = [
  { key: 'diet', label: '飲食', icon: UtensilsIcon },
  { key: 'training', label: '訓練', icon: DumbbellIcon },
  { key: 'body', label: '身體', icon: ScaleIcon },
];

export function WeeklyAdvice({ start, onPolicy }: { start: string; onPolicy: () => void }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [agreeing, setAgreeing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .post(`/progress/weekly/${start}/advice`)
      .then((advice: Advice | null) => {
        if (live) setState(advice ? { kind: 'ready', advice } : { kind: 'none' });
      })
      .catch((error) => {
        if (!live) return;
        if (error instanceof ApiError && error.status === 428) setState({ kind: 'consent' });
        else setState({ kind: 'failed', message: 'AI 建議暫時無法產生' });
      });
    return () => {
      live = false;
    };
  }, [start, attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const agree = async () => {
    setAgreeing(true);
    try {
      if (await setAiConsent(true)) retry();
    } catch {
      setState({ kind: 'failed', message: '無法儲存設定，請稍後再試' });
    } finally {
      setAgreeing(false);
    }
  };

  if (state.kind === 'none') return null;

  return (
    <View className="gap-2">
      <Text className="text-base text-ink">AI 建議</Text>
      <View className="gap-3 rounded-tile border-[1.5px] border-edge bg-surface px-4 py-3">
        {state.kind === 'loading' ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator color={color.primary} />
            <Text className="text-sm text-muted">整理建議中…</Text>
          </View>
        ) : state.kind === 'ready' ? (
          <>
            <View className="gap-1">
              <Text className="text-sm text-muted">回顧</Text>
              <Text className="text-base text-ink">{state.advice.summary}</Text>
            </View>
            <View className="h-px bg-line" />
            <View className="gap-2">
              <Text className="text-sm text-muted">下週建議</Text>
              {LINES.map((line) => (
                <View key={line.key} className="flex-row gap-2">
                  <View className="pt-0.5">
                    <line.icon size={16} tint={color.ink} />
                  </View>
                  <Text className="flex-1 text-base text-ink">
                    <Text className="text-base text-muted">{line.label}　</Text>
                    {state.advice[line.key]}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : state.kind === 'consent' ? (
          <>
            <AiConsentText onPolicy={onPolicy} />
            {/* Outlined: in the pop-up 知道了 is the berry button. */}
            <PrimaryButton tone="plain" onPress={agree} busy={agreeing}>
              同意並產生建議
            </PrimaryButton>
          </>
        ) : (
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-sm text-muted">{state.message}</Text>
            <TextAction label="再試一次" onPress={retry} />
          </View>
        )}
      </View>
    </View>
  );
}
