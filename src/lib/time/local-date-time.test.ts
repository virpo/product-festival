import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  fromLocalDateTimeInput,
  toLocalDateTimeInput,
} from "./local-date-time";

const originalTimezone = process.env.TZ;

describe("local datetime inputs", () => {
  beforeAll(() => {
    process.env.TZ = "Europe/Bratislava";
  });

  afterAll(() => {
    process.env.TZ = originalTimezone;
  });

  it("shows a UTC deadline in Bratislava local time", () => {
    expect(toLocalDateTimeInput("2026-07-31T13:00:00.000Z")).toBe(
      "2026-07-31T15:00",
    );
  });

  it("roundtrips the local value without shifting the deadline", () => {
    const local = toLocalDateTimeInput("2026-07-31T13:00:00.000Z");

    expect(fromLocalDateTimeInput(local)).toBe("2026-07-31T13:00:00.000Z");
  });

  it("keeps an unset deadline unset", () => {
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(fromLocalDateTimeInput("")).toBeNull();
  });
});
