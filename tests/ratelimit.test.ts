import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isRateLimited,
  recordFailure,
  clearFailures,
} from "../src/lib/ratelimit";

// The module uses a private Map called `store`. We cannot clear it directly.
// Strategy: use a unique key prefix per test so tests never share state.
// A monotonic counter ensures keys are unique even within the same describe block.
let keyCounter = 0;
function uniqueKey(): string {
  return `test-key-${++keyCounter}`;
}

// Constants mirrored from ratelimit.ts (must match exactly)
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

describe("ratelimit — basic behavior", () => {
  it("is not rate-limited on first check (no failures recorded)", () => {
    const key = uniqueKey();
    expect(isRateLimited(key)).toBe(false);
  });

  it("recordFailure returns false for the first failure", () => {
    const key = uniqueKey();
    expect(recordFailure(key)).toBe(false);
  });

  it("recordFailure returns false for failures 1 through MAX_ATTEMPTS-1", () => {
    const key = uniqueKey();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(recordFailure(key)).toBe(false);
    }
    expect(isRateLimited(key)).toBe(false);
  });

  it("recordFailure returns true on the MAX_ATTEMPTS-th failure (limit hit)", () => {
    const key = uniqueKey();
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    // The MAX_ATTEMPTS-th call should flip to true
    expect(recordFailure(key)).toBe(true);
  });

  it("isRateLimited returns true immediately after hitting the limit", () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(isRateLimited(key)).toBe(true);
  });
});

describe("ratelimit — clearFailures", () => {
  it("clearFailures resets so the key is no longer rate-limited", () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(isRateLimited(key)).toBe(true);
    clearFailures(key);
    expect(isRateLimited(key)).toBe(false);
  });

  it("clearFailures allows recording failures again from scratch", () => {
    const key = uniqueKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    clearFailures(key);
    // Now one failure should not re-lock
    expect(recordFailure(key)).toBe(false);
    expect(isRateLimited(key)).toBe(false);
  });

  it("clearFailures on a key that was never recorded does not throw", () => {
    const key = uniqueKey();
    expect(() => clearFailures(key)).not.toThrow();
    expect(isRateLimited(key)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Time-based tests using fake timers
// ---------------------------------------------------------------------------
describe("ratelimit — window expiry (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("failures in a new window after WINDOW_MS do not carry over", () => {
    const key = uniqueKey();

    // Record MAX_ATTEMPTS - 1 failures in the current window (not yet locked)
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure(key);
    }
    expect(isRateLimited(key)).toBe(false);

    // Advance past the window so a new window starts
    vi.advanceTimersByTime(WINDOW_MS + 1);

    // First failure in the new window should return false (counter reset)
    expect(recordFailure(key)).toBe(false);
    expect(isRateLimited(key)).toBe(false);
  });

  it("lockout expires after LOCKOUT_MS and the key becomes available again", () => {
    const key = uniqueKey();

    // Trigger lockout
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(isRateLimited(key)).toBe(true);

    // Just before lockout expires — still locked
    vi.advanceTimersByTime(LOCKOUT_MS - 1);
    expect(isRateLimited(key)).toBe(true);

    // Advance past lockout
    vi.advanceTimersByTime(2);
    expect(isRateLimited(key)).toBe(false);
  });

  it("after lockout expires, failures start fresh and can lock again", () => {
    const key = uniqueKey();

    // First lockout
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    vi.advanceTimersByTime(LOCKOUT_MS + 1);
    expect(isRateLimited(key)).toBe(false);

    // New round of MAX_ATTEMPTS failures should lock again
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure(key);
    }
    expect(isRateLimited(key)).toBe(true);
  });

  it("failures within the same window accumulate toward the limit", () => {
    const key = uniqueKey();

    // 2 failures, advance time (still within window), 3 more -> should lock
    for (let i = 0; i < 2; i++) recordFailure(key);
    vi.advanceTimersByTime(WINDOW_MS / 2); // halfway through window
    for (let i = 0; i < MAX_ATTEMPTS - 3; i++) recordFailure(key); // 2 more
    expect(isRateLimited(key)).toBe(false);
    // Final failure that hits the cap
    expect(recordFailure(key)).toBe(true);
    expect(isRateLimited(key)).toBe(true);
  });
});
