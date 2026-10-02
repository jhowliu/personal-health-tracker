import { dayWord, shiftDay, todayISO } from '@/dates';

describe('shiftDay', () => {
  it('crosses month and year boundaries', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dayWord', () => {
  it('names today and yesterday, and dates further back', () => {
    const today = todayISO();
    expect(dayWord(today)).toBe('今天');
    expect(dayWord(shiftDay(today, -1))).toBe('昨天');
    expect(dayWord('2026-09-28')).toBe('9/28');
  });
});
