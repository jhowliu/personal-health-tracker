import { daysBetween, valueAxis } from '@/components/trend-axis';

describe('valueAxis', () => {
  it('keeps a small wobble small by drawing at least the minimum span', () => {
    const axis = valueAxis([81.0, 81.4, 81.2], 2);

    expect(axis.max - axis.min).toBeGreaterThanOrEqual(2);
    expect(axis.min).toBeLessThanOrEqual(81.0);
    expect(axis.max).toBeGreaterThanOrEqual(81.4);
    expect(axis.ticks).toEqual([80, 81, 82, 83]);
  });

  it('puts gridlines on round numbers when the range is wide', () => {
    expect(valueAxis([81, 99], 2)).toEqual({ min: 80, max: 100, ticks: [80, 90, 100] });
  });

  it('copes with a single value', () => {
    const axis = valueAxis([56], 2);

    expect(axis.min).toBeLessThan(56);
    expect(axis.max).toBeGreaterThan(56);
  });
});

it('counts calendar days, across a month end', () => {
  expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4);
  expect(daysBetween('2026-10-02', '2026-10-02')).toBe(0);
});
