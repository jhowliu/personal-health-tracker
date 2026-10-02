/**
 * The session in progress, kept on the phone so a killed app can carry on (spec §4).
 * The logged sets live on the server; this only holds what the phone alone knows.
 * Storage can be unavailable (private mode, cleared data), so every call fails quietly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Session } from '@/workouts/focus/session';

const key = (date: string) => `focus-session:${date}`;

export async function loadSession(date: string): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(key(date));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await AsyncStorage.setItem(key(session.date), JSON.stringify(session));
  } catch {
    // The server still has every set; only the clock and the rest would be lost.
  }
}

export async function clearSession(date: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(date));
  } catch {
    // Nothing to do: a stale entry is replaced the next time this date starts.
  }
}
