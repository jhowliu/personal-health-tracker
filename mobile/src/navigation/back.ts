import { router, type Href } from 'expo-router';

/** Return through an in-app stack when possible, otherwise land on the semantic parent. */
export function backOrReplace(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
