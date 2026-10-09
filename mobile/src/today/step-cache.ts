/**
 * The last plan, workout and body summary seen on the today screen, by day.
 *
 * Each step of the day is its own screen, so moving along the track mounts a new one. Drawing
 * it from here keeps it from flashing a spinner (and its footer popping in) while the same data
 * loads again. Every visit still refreshes what is kept. Cleared on sign-out, so another account
 * never sees it.
 */
import { api } from '@/api/client';

const kept = new Map<string, unknown>();

export const stepCache = {
  get<T>(key: string): T | null {
    return (kept.get(key) as T | undefined) ?? null;
  },
  set(key: string, value: unknown) {
    kept.set(key, value);
  },
  /** Fetch a day's plan and workout ahead, so the first step change already has them. */
  prefetch(date: string) {
    void api
      .get(`/days/${date}/plan`)
      .then((plan) => kept.set(`plan:${date}`, plan))
      .catch(() => {});
    void api
      .get(`/days/${date}/workout`)
      .then((workout) => kept.set(`workout:${date}`, workout))
      .catch(() => {});
  },
  clearAll() {
    kept.clear();
  },
};
