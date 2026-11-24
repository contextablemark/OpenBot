/**
 * The conversation list's compact time, as OpenBot on the computer shows it (app/src/lib/relative-time.ts):
 * "now", "5m", "3h", "2d", "6w". Rounded down, and a time slightly ahead of this clock reads "now". It imports
 * nothing, so it can be tested without a phone.
 */
const SHORT_UNITS = [
  { limit: 3_600_000, divisor: 60_000, suffix: "m" },
  { limit: 86_400_000, divisor: 3_600_000, suffix: "h" },
  { limit: 604_800_000, divisor: 86_400_000, suffix: "d" },
  { limit: Number.POSITIVE_INFINITY, divisor: 604_800_000, suffix: "w" },
] as const;

export function relativeTimeShort(iso: string, now: Date = new Date()): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  const elapsed = now.getTime() - time;
  if (elapsed < 60_000) return "now";
  const scale =
    SHORT_UNITS.find(({ limit }) => elapsed < limit) ??
    SHORT_UNITS[SHORT_UNITS.length - 1];
  return `${Math.floor(elapsed / scale.divisor)}${scale.suffix}`;
}
