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
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';

type Advice = Schema<'WeeklyAdviceOut'>;
type State =
  | { kind: 'loading' }
  | { kind: 'ready'; advice: Advice }
  | { kind: 'consent' }
  | { kind: 'failed'; message: string }
  // A week with nothing logged has nothing to advise on.
  | { kind: 'none' };

export function WeeklyAdvice({ start, onPolicy }: { start: string; onPolicy: () => void }) {
  const { t } = useI18n();
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
        else setState({ kind: 'failed', message: t('progress.advice.unavailable') });
      });
    return () => {
      live = false;
    };
  }, [start, attempt, t]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const agree = async () => {
    setAgreeing(true);
    try {
      if (await setAiConsent(true)) retry();
    } catch {
      setState({ kind: 'failed', message: t('progress.advice.saveSettingsFailed') });
    } finally {
      setAgreeing(false);
    }
  };

  if (state.kind === 'none') return null;

  const lines: { key: 'diet' | 'training' | 'body'; label: string; icon: ComponentType<IconProps> }[] = [
    { key: 'diet', label: t('progress.advice.diet'), icon: UtensilsIcon },
    { key: 'training', label: t('progress.advice.training'), icon: DumbbellIcon },
    { key: 'body', label: t('progress.advice.body'), icon: ScaleIcon },
  ];

  return (
    <View className="gap-2">
      <Text className="text-base text-ink">{t('progress.advice.title')}</Text>
      <View className="gap-3 rounded-tile border-[1.5px] border-edge bg-surface px-4 py-3">
        {state.kind === 'loading' ? (
          <View className="flex-row items-center gap-2 py-2">
            <ActivityIndicator color={color.primary} />
            <Text className="text-sm text-muted">{t('progress.advice.loading')}</Text>
          </View>
        ) : state.kind === 'ready' ? (
          <>
            <View className="gap-1">
              <Text className="text-sm text-muted">{t('progress.advice.review')}</Text>
              <Text className="text-base text-ink">{state.advice.summary}</Text>
            </View>
            <View className="h-px bg-line" />
            <View className="gap-2">
              <Text className="text-sm text-muted">{t('progress.advice.nextWeek')}</Text>
              {lines.map((line) => (
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
              {t('progress.advice.consentAndGenerate')}
            </PrimaryButton>
          </>
        ) : (
          <View className="flex-row items-center justify-between py-1">
            <Text className="text-sm text-muted">{state.message}</Text>
            <TextAction label={t('common.actions.retry')} onPress={retry} />
          </View>
        )}
      </View>
    </View>
  );
}
