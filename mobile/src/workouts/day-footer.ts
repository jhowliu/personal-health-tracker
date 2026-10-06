/**
 * What the bottom of the day's workout offers. The list above it is the same in every state —
 * ready, paused, logged, done or skipped — so where the day stands only changes this.
 */
export type DayFooterState = {
  /** Focus mode only runs on today. */
  today: boolean;
  /** Exercises on the day, and how many of them are done. */
  total: number;
  finished: number;
  /** The day has a scheduled template or exercises; a plain rest day has neither. */
  planned: boolean;
  /** Some set is logged for the day. */
  logged: boolean;
  /** A focus session is kept on the phone: paused, or waiting at its summary. */
  session: boolean;
  /** Marked done. */
  done: boolean;
  /** Skipped and not done since. */
  skipped: boolean;
  /** Changes typed into the list and not saved yet. */
  dirty: boolean;
};

export type DayFooter =
  /** 儲存修改, with 放棄修改 under it. */
  | { kind: 'save' }
  /** 開始訓練 or 繼續訓練 into focus mode, with a quieter second way out under it. */
  | { kind: 'train'; resume: boolean; then: 'complete' | 'skip' | null }
  /** 完成這天的訓練: sets were typed in rather than done in focus mode. */
  | { kind: 'complete' }
  | { kind: 'skip' }
  | { kind: 'done' }
  | { kind: 'skipped' }
  /** A rest day with nothing on it: nothing to finish or skip. */
  | { kind: 'none' };

export function dayFooter(state: DayFooterState): DayFooter {
  // Nothing offers a way out that drops what was typed.
  if (state.dirty) return { kind: 'save' };
  const toDo = state.finished < state.total;
  // A session at its summary has nothing left to do but is still finished in focus mode,
  // where the trained time is saved with it.
  if (state.today && state.total > 0 && (toDo || state.session)) {
    const then = state.done ? null : state.logged ? 'complete' : state.skipped ? null : 'skip';
    return { kind: 'train', resume: state.session || state.logged, then };
  }
  if (state.done) return { kind: 'done' };
  if (state.logged) return { kind: 'complete' };
  if (state.skipped) return { kind: 'skipped' };
  return state.planned ? { kind: 'skip' } : { kind: 'none' };
}
