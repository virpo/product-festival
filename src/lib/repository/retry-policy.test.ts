import { describe, expect, it } from "vitest";
import { retryDelay } from "./retry-policy";

describe("retryDelay", () => {
  it("backs off quickly, then polls every 30 seconds", () => {
    expect([1, 2, 3, 4, 9].map((attempt) => retryDelay(attempt, () => 0))).toEqual([
      2_000,
      5_000,
      30_000,
      30_000,
      30_000,
    ]);
  });

  it("spreads reconnects so a venue-wide outage does not synchronize clients", () => {
    expect(retryDelay(1, () => 0)).toBe(2_000);
    expect(retryDelay(1, () => 1)).toBe(2_500);
    expect(retryDelay(3, () => 1)).toBe(37_500);
  });

  it("keeps every delay inside its attempt envelope for any random value", () => {
    for (const random of [0, 0.13, 0.5, 0.87, 0.999]) {
      expect(retryDelay(1, () => random)).toBeGreaterThanOrEqual(2_000);
      expect(retryDelay(1, () => random)).toBeLessThanOrEqual(2_500);
      expect(retryDelay(9, () => random)).toBeGreaterThanOrEqual(30_000);
      expect(retryDelay(9, () => random)).toBeLessThanOrEqual(37_500);
    }
  });
});
