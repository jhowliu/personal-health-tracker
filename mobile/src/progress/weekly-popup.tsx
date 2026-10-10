/**
 * The weekly report that pops up once: the last finished week, or this one on a Sunday whose
 * flow is done. The server decides which and whether; today asks it with
 * `checkWeeklyReport()`, and WeeklyReportHost, mounted once under the tabs, draws the answer.
 */
import { useSyncExternalStore } from 'react';
import { ScrollView, View } from 'react-native';

import { api } from '@/api/client';
import { AppModal } from '@/components/AppModal';
import { Text } from '@/components/text';
import { PrimaryButton } from '@/components/ui';
import { todayISO } from '@/dates';
import { WeeklyReport, weekRange, type Review } from '@/progress/WeeklyReport';

let pending: Review | null = null;
let checking = false;
// A check asked for while one is on its way runs after it, so a Sunday just finished is seen.
let again = false;
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

const current = () => pending;

/** Ask the server whether a week's report is due. Quiet on failure: it can wait for next time. */
export async function checkWeeklyReport(): Promise<void> {
  if (pending) return;
  if (checking) {
    again = true;
    return;
  }
  checking = true;
  try {
    pending = await api.get('/progress/weekly/pending');
    notify();
  } catch {
    // Nothing to show; the next check tries again.
  } finally {
    checking = false;
  }
  if (again) {
    again = false;
    await checkWeeklyReport();
  }
}

export function WeeklyReportHost() {
  const review = useSyncExternalStore(subscribe, current, current);
  if (!review) return null;

  const close = () => {
    pending = null;
    notify();
    // If this fails the report pops up once more, which is better than never.
    api.post(`/progress/weekly/${review.start}/seen`).catch(() => {});
  };

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-scrim px-5 py-10">
        {/* With the advice it outgrows a small phone: the report scrolls, 知道了 stays put. */}
        <View className="max-h-full w-full max-w-[400px] gap-4 rounded-sheet border-2 border-edge bg-bg p-5">
          <ScrollView className="grow-0" contentContainerClassName="gap-4">
            <View className="gap-1">
              <Text accessibilityRole="header" className="text-2xl text-ink">
                {review.end >= todayISO() ? '這週週報' : '上週週報'}
              </Text>
              <Text className="text-sm text-muted">{weekRange(review)}</Text>
            </View>
            <WeeklyReport review={review} onLeave={close} />
          </ScrollView>
          <PrimaryButton onPress={close}>知道了</PrimaryButton>
        </View>
      </View>
    </AppModal>
  );
}
