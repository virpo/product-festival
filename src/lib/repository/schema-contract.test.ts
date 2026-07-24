// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202607240001_product_festival.sql",
);

describe("Supabase schema contract", () => {
  it("defines protected tables and aggregate realtime state", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();

    for (const table of [
      "events",
      "teams",
      "people",
      "team_members",
      "visits",
      "signals",
      "event_stats",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(sql).toContain(
      "alter publication supabase_realtime add table public.event_stats",
    );
  });

  it("keeps raw signals private and release-gated", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();

    expect(sql).toContain("signals_select_own_or_released_team");
    expect(sql).toContain("status = 'released'");
    expect(sql).not.toContain("signals_select_public");
    expect(sql).toContain("save_signal");
    expect(sql).toContain("claim_person");
  });
});
