import { describe, expect, it } from "vitest";
import { parseTeamCode } from "./qr";

describe("parseTeamCode", () => {
  it.each([
    ["QUEUE7", "QUEUE7"],
    [" queue7 ", "QUEUE7"],
    ["https://festival.test/t/QUEUE7", "QUEUE7"],
    ["https://festival.test/t/queue7?src=print", "QUEUE7"],
  ])("parses %s", (input, expected) => {
    expect(parseTeamCode(input)).toBe(expected);
  });

  it.each(["", "https://festival.test/", "not a valid code"])(
    "rejects %s",
    (input) => {
      expect(parseTeamCode(input)).toBeNull();
    },
  );
});
