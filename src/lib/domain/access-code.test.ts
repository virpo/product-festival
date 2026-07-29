import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_MAX_LENGTH,
  normalizeAccessCode,
} from "./access-code";

describe("access codes", () => {
  it("normalizes human input without changing its identity", () => {
    expect(normalizeAccessCode("  peter-24  ")).toBe("PETER-24");
  });

  it("uses the same maximum length in entry and administration", () => {
    expect(ACCESS_CODE_MAX_LENGTH).toBe(24);
  });
});
