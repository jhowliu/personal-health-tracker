/**
 * Where tokens live. On iOS/Android that is the Keychain/Keystore via expo-secure-store.
 *
 * Web exists only so the screens can be checked quickly in a browser during development.
 * It is not a shipping target, so it falls back to localStorage; real user data always
 * goes through native secure storage.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const secureStorage = {
  get:
    Platform.OS === 'web'
      ? async (key: string) => globalThis.localStorage?.getItem(key) ?? null
      : (key: string) => SecureStore.getItemAsync(key),

  set:
    Platform.OS === 'web'
      ? async (key: string, value: string) => globalThis.localStorage?.setItem(key, value)
      : (key: string, value: string) => SecureStore.setItemAsync(key, value),

  remove:
    Platform.OS === 'web'
      ? async (key: string) => globalThis.localStorage?.removeItem(key)
      : (key: string) => SecureStore.deleteItemAsync(key),
};
