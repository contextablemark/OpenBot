/**
 * When OpenBot last said "too many requests" (429), and how long it asked the phone to wait: every screen's polling
 * holds off until then (./use-load.ts), so a refusal isn't answered with more of the same. ./api/request.ts records it.
 * It imports nothing, so it can be tested without a phone.
 */
let waitUntil = 0;

/** OpenBot refused a request as too many: wait `retryAfterSeconds` (or a short while when it didn't say). */
export function reportRateLimited(
  retryAfterSeconds: number | null,
  now = Date.now(),
): void {
  const seconds =
    retryAfterSeconds !== null &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
      ? Math.min(retryAfterSeconds, 300)
      : 30;
  waitUntil = Math.max(waitUntil, now + seconds * 1000);
}

/** Whether polling should hold off now. */
export function rateLimited(now = Date.now()): boolean {
  return now < waitUntil;
}
