const RETRY_INTERVAL_MS = 100;
const MAX_RETRIES = 20;

/** Retry transient zero-size spotlight measurements during native screen transitions. */
export function startSpotlightMeasurementRetries(
  measure: () => void,
): () => void {
  let attempts = 0;
  const timer = setInterval(() => {
    measure();
    attempts += 1;
    if (attempts >= MAX_RETRIES) clearInterval(timer);
  }, RETRY_INTERVAL_MS);

  return () => clearInterval(timer);
}
