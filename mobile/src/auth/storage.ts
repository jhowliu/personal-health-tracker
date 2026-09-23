/**
 * Token 放哪裡。iOS／Android 用 Keychain／Keystore(expo-secure-store)。
 *
 * Web 只是開發時用瀏覽器快速看畫面的路徑,不是上架目標,所以退回 localStorage;
 * 真正的使用者資料永遠走原生的安全儲存。
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
