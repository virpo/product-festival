import { describe, expect, it } from "vitest";
import { formatCredits } from "./credits";

describe("formatCredits", () => {
  it("places a pancake marker after the amount", () => {
    expect(formatCredits(100, "🥞")).toBe("100🥞");
  });

  it("places every configured marker after the amount", () => {
    expect(formatCredits(17, "€")).toBe("17€");
  });
});
