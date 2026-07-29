import { describe, expect, it } from "vitest";
import { retryDelay } from "./retry-policy";

describe("retryDelay", () => {
  it("backs off quickly, then polls every 30 seconds", () => {
    expect([1, 2, 3, 4, 9].map(retryDelay)).toEqual([
      2_000,
      5_000,
      30_000,
      30_000,
      30_000,
    ]);
  });
});
