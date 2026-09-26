import type { Href } from 'expo-router';

const AUTH_ROUTES = ['/login', '/register', '/profile-setup'] as const;

export function safeReturnTo(value: string | string[] | undefined, fallback: Href = '/today'): Href {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  if (AUTH_ROUTES.some((route) => path.startsWith(route))) return fallback;
  // Expo Router cannot infer a runtime-validated path, but the checks above keep it internal.
  return path as Href;
}
