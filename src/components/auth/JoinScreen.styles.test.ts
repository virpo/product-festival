import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("join button styles", () => {
  it("keeps its label and icon away from the rounded edges", () => {
    const styles = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const primaryButton = styles.match(/\.primary-button\s*\{([^}]*)\}/)?.[1];

    expect(primaryButton).toMatch(/padding-inline:\s*[^;]+;/);
  });
});
