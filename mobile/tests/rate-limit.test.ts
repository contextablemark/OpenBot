import { expect, test } from "bun:test";
import { rateLimited, reportRateLimited } from "../src/rate-limit";

test("polling holds off for as long as OpenBot asks, then resumes", () => {
  const now = 1_000_000;
  expect(rateLimited(now)).toBe(false);
  reportRateLimited(32, now);
  expect(rateLimited(now + 31_000)).toBe(true);
  expect(rateLimited(now + 33_000)).toBe(false);
});

test("without a Retry-After it waits a short while, and never more than five minutes", () => {
  const now = 2_000_000;
  reportRateLimited(null, now);
  expect(rateLimited(now + 29_000)).toBe(true);
  expect(rateLimited(now + 31_000)).toBe(false);
  reportRateLimited(100_000, now);
  expect(rateLimited(now + 299_000)).toBe(true);
  expect(rateLimited(now + 301_000)).toBe(false);
});
