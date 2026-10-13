import { startSpotlightMeasurementRetries } from './measurement-retry';

describe('spotlight measurement retry', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('measures again after a native transition initially reports a zero-size target', () => {
    let ready = false;
    let targetRect: { width: number; height: number } | null = null;
    const measure = jest.fn(() => {
      if (ready) targetRect = { width: 342, height: 54 };
    });
    const stop = startSpotlightMeasurementRetries(measure);

    measure();
    expect(targetRect).toBeNull();

    ready = true;
    jest.advanceTimersByTime(100);

    expect(measure).toHaveBeenCalledTimes(2);
    expect(targetRect).toEqual({ width: 342, height: 54 });
    stop();
  });

  it('stops retrying after a bounded transition window', () => {
    const measure = jest.fn();
    startSpotlightMeasurementRetries(measure);

    jest.advanceTimersByTime(10_000);

    expect(measure).toHaveBeenCalledTimes(20);
  });
});
