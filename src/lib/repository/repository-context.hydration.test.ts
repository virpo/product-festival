// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("FestivalProvider hydration contract", () => {
  it("initializes the browser repository only after the first shared render", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/repository/repository-context.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "useState<FestivalRepository | null>(null)",
    );
    expect(source).toContain(
      "setRepository(createFestivalRepository(window.localStorage))",
    );
    expect(source).not.toContain('typeof window === "undefined"');
  });
});
