import { router } from 'expo-router';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { api } from '@/api/client';
import { useSession } from '@/auth/session';
import { AppModal } from '@/components/AppModal';
import { Text } from '@/components/text';
import { Card, PrimaryButton, TextAction } from '@/components/ui';
import { useI18n } from '@/i18n/runtime';
import { color } from '@/theme/tokens';

import {
  buildTourSteps,
  CURRENT_ONBOARDING_VERSION,
  type TourStep,
  type TourStepId,
  type TourTargetId,
} from './tour';
import { startSpotlightMeasurementRetries } from './measurement-retry';

type TourPhase = 'idle' | 'offer' | 'running' | 'complete';

type TargetRegistration = {
  node: View;
  activate?: () => void;
  radius: number;
};

export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  canActivate: boolean;
};

type OnboardingContextValue = {
  phase: TourPhase;
  step: TourStep | null;
  stepNumber: number;
  stepCount: number;
  targetRect: SpotlightRect | null;
  canPerformCurrentAction: boolean;
  shouldOffer: boolean;
  replayRequested: boolean;
  offer: (bodyLogged: boolean) => void;
  requestReplay: () => void;
  advance: () => void;
  back: () => void;
  performCurrentAction: () => void;
  actionCompleted: (step: TourStepId) => void;
  defer: () => void;
  skip: () => void;
  dismissComplete: () => void;
  registerTarget: (
    id: TourTargetId,
    node: View | null,
    options?: { activate?: () => void; radius?: number },
  ) => void;
  refreshTarget: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [seenVersion, setSeenVersion] = useState<number | null>(null);
  const [phase, setPhase] = useState<TourPhase>('idle');
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [offeredThisSession, setOfferedThisSession] = useState(false);
  const [deferredThisSession, setDeferredThisSession] = useState(false);
  const [replayRequested, setReplayRequested] = useState(false);
  const hostRef = useRef<View>(null);
  const targets = useRef(new Map<TourTargetId, TargetRegistration>());
  const phaseRef = useRef<TourPhase>('idle');
  const stepIndexRef = useRef(0);
  const stepsRef = useRef<TourStep[]>([]);
  const step = steps[stepIndex] ?? null;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    if (status !== 'ready') {
      const frame = requestAnimationFrame(() => {
        setSeenVersion(null);
        setPhase('idle');
        setSteps([]);
        setStepIndex(0);
        setTargetRect(null);
        setOfferedThisSession(false);
        setDeferredThisSession(false);
        setReplayRequested(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    let live = true;
    api
      .get('/users/me/onboarding')
      .then((progress) => {
        if (live) setSeenVersion(progress.version);
      })
      .catch(() => {
        // Onboarding must never make the main app unavailable. Retry on the next session.
        if (live) setSeenVersion(CURRENT_ONBOARDING_VERSION);
      });
    return () => {
      live = false;
    };
  }, [status]);

  const measureTarget = useCallback(() => {
    const current = stepsRef.current[stepIndexRef.current];
    const target = current ? targets.current.get(current.target) : undefined;
    const host = hostRef.current;
    if (phaseRef.current !== 'running' || !host || !target) {
      setTargetRect(null);
      return;
    }

    host.measureInWindow((hostX, hostY, hostWidth, hostHeight) => {
      target.node.measureInWindow((targetX, targetY, width, height) => {
        if (!width || !height) {
          setTargetRect(null);
          return;
        }
        const padding = 7;
        const x = Math.max(4, targetX - hostX - padding);
        const y = Math.max(4, targetY - hostY - padding);
        const right = Math.min(
          hostWidth - 4,
          targetX - hostX + width + padding,
        );
        const bottom = Math.min(
          hostHeight - 4,
          targetY - hostY + height + padding,
        );
        if (right <= 4 || bottom <= 4 || x >= hostWidth || y >= hostHeight) {
          setTargetRect(null);
          return;
        }
        setTargetRect({
          x,
          y,
          width: Math.max(0, right - x),
          height: Math.max(0, bottom - y),
          radius: target.radius,
          canActivate: Boolean(target.activate),
        });
      });
    });
  }, []);

  const refreshTarget = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(measureTarget));
  }, [measureTarget]);

  useEffect(() => {
    refreshTarget();
  }, [phase, stepIndex, refreshTarget]);

  // Native navigation and Modal dismissal can briefly report a zero-sized target even after the
  // next screen has mounted. onLayout is not guaranteed to fire again, so retry for a short,
  // bounded window instead of leaving the tour on its waiting state forever.
  useEffect(() => {
    if (phase !== 'running' || targetRect) return;
    return startSpotlightMeasurementRetries(measureTarget);
  }, [phase, stepIndex, targetRect, measureTarget]);

  useEffect(() => {
    if (phase !== 'running') return;
    const shown = Keyboard.addListener('keyboardDidShow', refreshTarget);
    const hidden = Keyboard.addListener('keyboardDidHide', refreshTarget);
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [phase, refreshTarget]);

  const registerTarget = useCallback<OnboardingContextValue['registerTarget']>(
    (id, node, options) => {
      if (node) {
        targets.current.set(id, {
          node,
          activate: options?.activate,
          radius: options?.radius ?? 14,
        });
      } else {
        targets.current.delete(id);
      }
      const current = stepsRef.current[stepIndexRef.current];
      if (current?.target === id) refreshTarget();
    },
    [refreshTarget],
  );

  const saveSeen = useCallback(() => {
    setSeenVersion(CURRENT_ONBOARDING_VERSION);
    void api
      .put('/users/me/onboarding', { version: CURRENT_ONBOARDING_VERSION })
      .catch(() => {});
  }, []);

  const offer = useCallback((bodyLogged: boolean) => {
    setOfferedThisSession(true);
    setReplayRequested(false);
    setSteps(buildTourSteps(bodyLogged));
    setStepIndex(0);
    setTargetRect(null);
    setPhase('offer');
  }, []);

  const requestReplay = useCallback(() => {
    setDeferredThisSession(false);
    setReplayRequested(true);
  }, []);

  const begin = useCallback(() => setPhase('running'), []);
  const defer = useCallback(() => {
    setDeferredThisSession(true);
    setPhase('idle');
  }, []);
  const skip = useCallback(() => {
    saveSeen();
    setPhase('idle');
    setTargetRect(null);
  }, [saveSeen]);
  const dismissComplete = useCallback(() => {
    setPhase('idle');
    setTargetRect(null);
  }, []);

  const finishOrAdvance = useCallback(() => {
    const nextIndex = stepIndexRef.current + 1;
    if (nextIndex >= stepsRef.current.length) {
      saveSeen();
      setPhase('complete');
      setTargetRect(null);
      return;
    }
    setTargetRect(null);
    setStepIndex(nextIndex);
  }, [saveSeen]);

  const advance = useCallback(() => {
    const current = stepsRef.current[stepIndexRef.current];
    if (!current || current.action) return;
    finishOrAdvance();
  }, [finishOrAdvance]);

  const back = useCallback(() => {
    const current = stepsRef.current[stepIndexRef.current];
    if (!current?.canBack || stepIndexRef.current === 0) return;
    if (current.id === 'food-search') router.back();
    setTargetRect(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  const performCurrentAction = useCallback(() => {
    const current = stepsRef.current[stepIndexRef.current];
    if (!current) return;
    targets.current.get(current.target)?.activate?.();
  }, []);

  const actionCompleted = useCallback(
    (id: TourStepId) => {
      const current = stepsRef.current[stepIndexRef.current];
      if (phaseRef.current === 'running' && current?.id === id)
        finishOrAdvance();
    },
    [finishOrAdvance],
  );

  const shouldOffer =
    status === 'ready' &&
    seenVersion !== null &&
    seenVersion < CURRENT_ONBOARDING_VERSION &&
    !offeredThisSession &&
    !deferredThisSession;
  const canPerformCurrentAction = Boolean(targetRect?.canActivate);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      phase,
      step,
      stepNumber: step ? stepIndex + 1 : 0,
      stepCount: steps.length,
      targetRect,
      canPerformCurrentAction,
      shouldOffer,
      replayRequested,
      offer,
      requestReplay,
      advance,
      back,
      performCurrentAction,
      actionCompleted,
      defer,
      skip,
      dismissComplete,
      registerTarget,
      refreshTarget,
    }),
    [
      phase,
      step,
      stepIndex,
      steps.length,
      targetRect,
      canPerformCurrentAction,
      shouldOffer,
      replayRequested,
      offer,
      requestReplay,
      advance,
      back,
      performCurrentAction,
      actionCompleted,
      defer,
      skip,
      dismissComplete,
      registerTarget,
      refreshTarget,
    ],
  );
  const modalVisible = phase !== 'idle';

  return (
    <OnboardingContext value={value}>
      <View ref={hostRef} className="flex-1" onLayout={refreshTarget}>
        <View
          className="flex-1"
          aria-hidden={modalVisible}
          accessibilityElementsHidden={modalVisible}
          importantForAccessibility={
            modalVisible ? 'no-hide-descendants' : 'auto'
          }
        >
          {children}
        </View>
        <OnboardingHost onStart={begin} />
      </View>
    </OnboardingContext>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = use(OnboardingContext);
  if (!context)
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  return context;
}

function OnboardingHost({ onStart }: { onStart: () => void }) {
  const tour = useOnboarding();
  const { t } = useI18n();

  useEffect(() => {
    if (tour.phase !== 'running' || !tour.step) return;
    AccessibilityInfo.announceForAccessibility(
      `${t('onboarding.progress', { current: tour.stepNumber, total: tour.stepCount })}. ${t(tour.step.title)}. ${t(tour.step.body)}`,
    );
  }, [tour.phase, tour.step, tour.stepNumber, tour.stepCount, t]);

  if (tour.phase === 'offer') {
    return (
      <AppModal
        visible
        transparent
        animationType="fade"
        onRequestClose={tour.defer}
      >
        <Pressable
          accessible={false}
          onPress={tour.defer}
          className="flex-1 justify-center bg-scrim px-5"
        >
          <Pressable
            accessible={false}
            onPress={(event) => event.stopPropagation()}
          >
            <Card className="gap-4">
              <View className="gap-2">
                <Text accessibilityRole="header" className="text-2xl text-ink">
                  {t('onboarding.offer.title')}
                </Text>
                <Text className="text-base leading-6 text-muted">
                  {t('onboarding.offer.body')}
                </Text>
              </View>
              <PrimaryButton onPress={onStart}>
                {t('onboarding.offer.start')}
              </PrimaryButton>
              <View className="flex-row items-center justify-between px-1">
                <TextAction
                  label={t('onboarding.offer.later')}
                  tone="muted"
                  onPress={tour.defer}
                />
                <TextAction
                  label={t('onboarding.offer.skip')}
                  onPress={tour.skip}
                />
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </AppModal>
    );
  }

  if (tour.phase === 'complete') {
    return (
      <AppModal
        visible
        transparent
        animationType="fade"
        onRequestClose={tour.dismissComplete}
      >
        <View className="flex-1 justify-center bg-scrim px-5">
          <Card className="gap-4">
            <View className="gap-2">
              <Text accessibilityRole="header" className="text-2xl text-ink">
                {t('onboarding.complete.title')}
              </Text>
              <Text className="text-base leading-6 text-muted">
                {t('onboarding.complete.body')}
              </Text>
            </View>
            <PrimaryButton onPress={tour.dismissComplete}>
              {t('onboarding.complete.done')}
            </PrimaryButton>
          </Card>
        </View>
      </AppModal>
    );
  }

  if (tour.phase !== 'running' || !tour.step) return null;
  // Native modals always sit above the app root. The add-food sheet renders this overlay
  // inside its own modal so that the highlighted library action remains visible.
  if (tour.step.id === 'meal-library') return null;
  return <SpotlightOverlay />;
}

export function SpotlightOverlay() {
  const tour = useOnboarding();
  const { t } = useI18n();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rect = tour.targetRect;
  const step = tour.step;

  const onLayout = (event: LayoutChangeEvent) => {
    setSize(event.nativeEvent.layout);
    tour.refreshTarget();
  };

  if (!step) return null;
  if (!rect || !size.width || !size.height) {
    return (
      <View
        style={StyleSheet.absoluteFill}
        className="items-center justify-center px-5"
        onLayout={onLayout}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <View style={StyleSheet.absoluteFill} className="bg-ink opacity-70" />
        <Card className="w-full items-center gap-4">
          <ActivityIndicator color={color.primary} />
          <Text className="text-center text-base text-muted">
            {t('onboarding.waiting')}
          </Text>
          <TextAction
            label={t('onboarding.actions.exit')}
            onPress={tour.skip}
          />
        </Card>
      </View>
    );
  }

  const below = rect.y + rect.height < size.height * 0.53;
  const tooltipPosition = below
    ? {
        top: Math.max(
          12,
          Math.min(size.height - 250, rect.y + rect.height + 12),
        ),
      }
    : {
        bottom: Math.max(
          12,
          Math.min(size.height - 250, size.height - rect.y + 12),
        ),
      };
  const target = {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  };

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      accessibilityViewIsModal
      importantForAccessibility="yes"
      onAccessibilityEscape={tour.skip}
    >
      <Scrim style={{ left: 0, right: 0, top: 0, height: target.top }} />
      <Scrim
        style={{
          left: 0,
          width: target.left,
          top: target.top,
          height: rect.height,
        }}
      />
      <Scrim
        style={{
          left: target.right,
          right: 0,
          top: target.top,
          height: rect.height,
        }}
      />
      <Scrim style={{ left: 0, right: 0, top: target.bottom, bottom: 0 }} />
      {step.blockTarget ? (
        <Pressable
          accessible={false}
          onPress={() => {}}
          style={{
            position: 'absolute',
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
          borderWidth: 3,
          borderColor: color.surface,
        }}
      />

      <View style={[styles.tooltip, tooltipPosition]}>
        <Card className="gap-3 shadow-lg">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="text-sm text-muted">
              {t('onboarding.progress', {
                current: tour.stepNumber,
                total: tour.stepCount,
              })}
            </Text>
            <TextAction
              label={t('onboarding.actions.exit')}
              tone="muted"
              onPress={tour.skip}
            />
          </View>
          <View className="gap-1.5">
            <Text accessibilityRole="header" className="text-xl text-ink">
              {t(step.title)}
            </Text>
            <Text className="text-base leading-6 text-muted">
              {t(step.body)}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {step.canBack ? (
              <View className="min-w-[88px]">
                <PrimaryButton tone="plain" onPress={tour.back}>
                  {t('onboarding.actions.back')}
                </PrimaryButton>
              </View>
            ) : null}
            <View className="flex-1">
              <PrimaryButton
                onPress={step.action ? tour.performCurrentAction : tour.advance}
                disabled={step.action ? !tour.canPerformCurrentAction : false}
              >
                {step.action ? t(step.action) : t('onboarding.actions.next')}
              </PrimaryButton>
            </View>
          </View>
        </Card>
      </View>
    </View>
  );
}

function Scrim({ style }: { style: object }) {
  return (
    <Pressable
      accessible={false}
      onPress={() => {}}
      style={[styles.scrim, style]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    backgroundColor: color.tourScrim,
  },
  tooltip: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
});
