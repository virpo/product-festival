import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("favicon", () => {
  it("uses the AI Build Week icon", () => {
    const icon = readFileSync(
      join(process.cwd(), "public/icon.svg"),
      "utf8",
    );

    expect(icon).toContain('viewBox="0 0 186 186"');
    expect(icon).toContain('<rect width="186" height="186" fill="black"/>');
    expect(icon.match(/<path /g)).toHaveLength(3);
    expect(icon).toContain('fill="#62C5C0"');
    expect(icon).toContain('fill="#F5A720"');
    expect(icon).toContain('fill="#ED3B5B"');
  });

  it("does not publish a competing app favicon", () => {
    expect(existsSync(join(process.cwd(), "src/app/favicon.ico"))).toBe(false);
  });
});
