import { describe, expect, it } from "vitest";
import { consumeRateLimit } from "../server/_core/rate-limit";

describe("sliding-window rate limiter", () => {
  it("allows requests up to the limit and then blocks", () => {
    const key = `test:${crypto.randomUUID()}`;

    for (let i = 0; i < 3; i++) {
      const result = consumeRateLimit(key, 3, 60_000);
      expect(result.allowed).toBe(true);
    }

    const blocked = consumeRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("tracks buckets independently per key", () => {
    const shared = `pair:${crypto.randomUUID()}`;
    const other = `other:${crypto.randomUUID()}`;

    consumeRateLimit(shared, 1, 60_000);
    expect(consumeRateLimit(shared, 1, 60_000).allowed).toBe(false);
    expect(consumeRateLimit(other, 1, 60_000).allowed).toBe(true);
  });
});
