/** Long lists are drawn a page at a time: the first rows, and a button for the next ones. */
import { useState } from 'react';

import { PrimaryButton } from '@/components/ui';

const PAGE_SIZE = 12;

/**
 * `resetKey` is whatever a new search or filter replaces (usually the list itself); when it
 * changes the list starts again from the first page.
 */
export function usePaged<T>(items: readonly T[], resetKey: unknown) {
  // The count belongs to one key. A different key means an old count, which is ignored, so
  // there is nothing to reset in an effect.
  const [paged, setPaged] = useState({ key: resetKey, shown: PAGE_SIZE });
  const shown = Object.is(paged.key, resetKey) ? paged.shown : PAGE_SIZE;

  return {
    visible: items.slice(0, shown),
    remaining: Math.max(0, items.length - shown),
    showMore: () => setPaged({ key: resetKey, shown: shown + PAGE_SIZE }),
  };
}

/** Renders nothing once every row is showing. */
export function ShowMore({ remaining, onPress }: { remaining: number; onPress: () => void }) {
  if (remaining <= 0) return null;
  return (
    <PrimaryButton tone="plain" onPress={onPress}>
      {`顯示更多（還有 ${remaining} 個）`}
    </PrimaryButton>
  );
}
