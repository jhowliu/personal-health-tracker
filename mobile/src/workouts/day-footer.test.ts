import { dayFooter, type DayFooterState } from '@/workouts/day-footer';

/** Today's scheduled workout of five, nothing done yet. */
function state(change: Partial<DayFooterState> = {}): DayFooterState {
  return {
    today: true,
    total: 5,
    finished: 0,
    planned: true,
    logged: false,
    session: false,
    done: false,
    skipped: false,
    dirty: false,
    ...change,
  };
}

describe('dayFooter', () => {
  it('starts the day, with 略過 as the way out', () => {
    expect(dayFooter(state())).toEqual({ kind: 'train', resume: false, then: 'skip' });
  });

  it('asks to save before anything else once something is typed', () => {
    expect(dayFooter(state({ dirty: true, session: true, logged: true }))).toEqual({ kind: 'save' });
  });

  it('resumes a paused session, which can still be skipped while nothing is logged', () => {
    expect(dayFooter(state({ session: true }))).toEqual({ kind: 'train', resume: true, then: 'skip' });
  });

  it('resumes once sets are logged, and can be finished from here', () => {
    expect(dayFooter(state({ logged: true, finished: 2 }))).toEqual({ kind: 'train', resume: true, then: 'complete' });
  });

  it('sends a finished session back to its summary, where the trained time is saved', () => {
    expect(dayFooter(state({ session: true, logged: true, finished: 5 }))).toEqual({
      kind: 'train',
      resume: true,
      then: 'complete',
    });
  });

  it('finishes a day whose every set was typed in', () => {
    expect(dayFooter(state({ logged: true, finished: 5 }))).toEqual({ kind: 'complete' });
  });

  it('keeps a skipped day open to training, without a second skip', () => {
    expect(dayFooter(state({ skipped: true }))).toEqual({ kind: 'train', resume: false, then: null });
  });

  it('lets a skipped day with sets typed in be marked done', () => {
    expect(dayFooter(state({ skipped: true, logged: true, finished: 1 }))).toEqual({
      kind: 'train',
      resume: true,
      then: 'complete',
    });
  });

  it('shows a done day as done', () => {
    expect(dayFooter(state({ done: true, logged: true, finished: 5 }))).toEqual({ kind: 'done' });
  });

  it('continues a done day when an exercise was added afterwards', () => {
    expect(dayFooter(state({ done: true, logged: true, finished: 5, total: 6 }))).toEqual({
      kind: 'train',
      resume: true,
      then: null,
    });
  });

  it('only offers 略過 on a scheduled day emptied of exercises', () => {
    expect(dayFooter(state({ total: 0 }))).toEqual({ kind: 'skip' });
  });

  it('offers nothing on a rest day with nothing on it', () => {
    expect(dayFooter(state({ total: 0, planned: false }))).toEqual({ kind: 'none' });
  });

  describe('on an earlier day, with no focus mode', () => {
    it('can be skipped while nothing is logged', () => {
      expect(dayFooter(state({ today: false }))).toEqual({ kind: 'skip' });
    });

    it('is finished by hand once sets are typed in', () => {
      expect(dayFooter(state({ today: false, logged: true, finished: 2 }))).toEqual({ kind: 'complete' });
    });

    it('says what it was', () => {
      expect(dayFooter(state({ today: false, done: true, logged: true }))).toEqual({ kind: 'done' });
      expect(dayFooter(state({ today: false, skipped: true }))).toEqual({ kind: 'skipped' });
    });
  });
});
