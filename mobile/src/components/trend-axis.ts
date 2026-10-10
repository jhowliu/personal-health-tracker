/** Scales for the trend charts (TrendChart, VolumeChart), kept apart so they can be tested. */

const DAY_MS = 24 * 60 * 60 * 1000;
const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 50];
const MAX_TICK_GAPS = 3;

const utcDay = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. */
export const daysBetween = (from: string, to: string) =>
  Math.round((utcDay(to) - utcDay(from)) / DAY_MS);

/**
 * The value range and its gridlines. The range is at least `minSpan` wide, so a 0.2 kg wobble
 * stays a wobble, and it is widened to whole steps so every gridline lands on a round number.
 */
export function valueAxis(values: number[], minSpan: number) {
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (high - low < minSpan) {
    const middle = (low + high) / 2;
    low = middle - minSpan / 2;
    high = middle + minSpan / 2;
  }
  const step =
    TICK_STEPS.find((candidate) => (high - low) / candidate <= MAX_TICK_GAPS) ??
    TICK_STEPS[TICK_STEPS.length - 1];
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(Math.round(tick * 10) / 10);
  return { min, max, ticks };
}

/**
 * A scale from zero, for bars: the top is rounded up to a whole step of 1, 2 or 5 × 10ⁿ, so
 * there are at most three gaps and every gridline is a round number.
 */
export function zeroAxis(high: number) {
  if (high <= 0) return { max: 1, ticks: [0, 1] };
  const magnitude = 10 ** Math.floor(Math.log10(high / MAX_TICK_GAPS));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => high / candidate <= MAX_TICK_GAPS) ??
    10 * magnitude;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step / 2; tick += step) ticks.push(Math.round(tick));
  return { max, ticks };
}
