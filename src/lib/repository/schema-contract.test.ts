// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/202607240001_product_festival.sql",
);
const bootstrapMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607240002_bootstrap_ai_build_week.sql",
);
const reliabilityMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607290001_festival_reliability.sql",
);
const investmentProgressMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607300001_investment_progress.sql",
);
const festivalSparksMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607310002_festival_sparks.sql",
);
const festivalSparksQualificationMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607310003_qualify_festival_sparks.sql",
);
const walletCoversSignalsMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607310001_wallet_covers_signals.sql",
);
const pancakeMarketMigrationPath = join(
  process.cwd(),
  "supabase/migrations/202607310004_pancake_market.sql",
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

  it("protects recorded feedback after investing closes", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    const insertPolicy = sql.slice(
      sql.indexOf("create policy festival_audio_insert_own"),
      sql.indexOf("create policy festival_audio_select_authorized"),
    );
    const deletePolicy = sql.slice(
      sql.indexOf("create policy festival_audio_delete_own"),
      sql.indexOf("alter publication supabase_realtime"),
    );

    expect(insertPolicy).toContain("status = 'open'");
    expect(deletePolicy).toContain("status = 'open'");
    expect(deletePolicy).toContain("not exists");
  });

  it("bootstraps the live AI Build Week event without demo teams or people", () => {
    const sql = readFileSync(bootstrapMigrationPath, "utf8").toLowerCase();

    expect(sql).toContain("insert into public.events");
    expect(sql).toContain("'ai-build-week'");
    expect(sql).toContain("'draft'");
    expect(sql).toContain("'$'");
    expect(sql).not.toContain("insert into public.teams");
    expect(sql).not.toContain("insert into public.people");
  });

  it("supports deliberate access-code takeover without shared sessions", () => {
    const sql = readFileSync(reliabilityMigrationPath, "utf8").toLowerCase();

    expect(sql).toContain("allow_takeover boolean");
    expect(sql).toContain("access_code_in_use");
    expect(sql).toContain("claimed_person.auth_user_id <> auth.uid()");
    expect(sql).toContain("set auth_user_id = auth.uid()");
  });

  it("keeps organizer and visit writes atomic", () => {
    const sql = readFileSync(reliabilityMigrationPath, "utf8").toLowerCase();

    expect(sql).toContain("create function public.save_person");
    expect(sql).toContain("membership_locked_after_signal");
    expect(sql).toContain("char_length(normalized_code) > 24");
    expect(sql).toContain("create function public.update_event_settings");
    expect(sql).toContain("revoke update on public.events from authenticated");
    expect(sql).toContain("create function public.record_visit");
    expect(sql).toContain("event_row.status <> 'open'");
    expect(sql).toContain("team_row.archived");
    expect(sql).toContain("cannot_visit_own_team");
    expect(sql).toContain("current_organizer_cannot_be_removed");
    expect(sql).toContain("last_organizer_cannot_be_removed");
    expect(sql).toContain(
      "revoke insert, update, delete on public.people, public.access_codes, public.team_members, public.visits from authenticated",
    );
  });

  it("publishes shared room state without exposing private activity", () => {
    const sql = readFileSync(reliabilityMigrationPath, "utf8").toLowerCase();

    for (const table of ["teams", "people", "team_members"]) {
      expect(sql).toContain(
        `alter publication supabase_realtime add table public.${table}`,
      );
    }

    for (const table of ["access_codes", "visits", "signals"]) {
      expect(sql).not.toContain(
        `alter publication supabase_realtime add table public.${table}`,
      );
    }
  });

  it("publishes wallet distribution toward one hundred percent", () => {
    const sql = readFileSync(
      investmentProgressMigrationPath,
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("budget_total");
    expect(sql).toContain("budget_distributed");
    expect(sql).toContain("budget_remaining");
    expect(sql).toContain("budget_distributed_percent");
    expect(sql).toContain("p.role <> 'organizer'");

    expect(sql).toContain("greatest(");
    // 100% must mean the budget is gone, so the percentage floors below
    // completion instead of rounding up to a full bar. Mirrors
    // deriveEventStats in src/lib/domain/stats.ts.
    expect(sql).toContain("when distributed >= total then 100");
    expect(sql).toContain("floor(100.0 * distributed / total)");
    expect(sql).not.toContain("round(100.0 * distributed / total)");
    expect(sql).toContain("refresh_event_stats");
  });
  it("keeps festival awards private and returns receipts atomically", () => {
    const sql = readFileSync(festivalSparksMigrationPath, "utf8").toLowerCase();
    expect(sql).toContain("create table public.bonus_awards");
    expect(sql).toContain("alter table public.bonus_awards enable row level security");
    expect(sql).toContain("bonus_awards_select_own");
    expect(sql).toContain("returns jsonb");
    expect(sql).toContain("new_awards");
    expect(sql).toContain("revoke all on function public.save_signal");
    expect(sql).not.toContain("alter publication supabase_realtime add table public.bonus_awards");
    expect(sql).toContain("create or replace function public.enforce_wallet_covers_signals");
    expect(sql).toContain("from public.bonus_awards award");
    expect(sql).toContain("award.person_id = new.id");
    expect(sql).toContain("when distributed >= total_budget then 100");
    expect(sql).toContain("floor(100.0 * distributed / total_budget)");
    expect(sql).not.toContain("round(100.0 * distributed / total_budget)");
  });

  it("qualifies award columns inside the Festival Spark RPC", () => {
    const sql = readFileSync(
      festivalSparksQualificationMigrationPath,
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("from public.bonus_awards award");
    expect(sql).toContain("award.achievement = 'team-joins-in'");
    expect(sql).toContain("award.achievement = 'first-light'");
    expect(sql).not.toMatch(
      /from public\.bonus_awards where[^;]*\bachievement\s*=/,
    );
  });

  it("keeps a wallet at or above the credits already committed", () => {
    const sql = readFileSync(
      walletCoversSignalsMigrationPath,
      "utf8",
    ).toLowerCase();

    // save_person ships in an already-applied migration, so the invariant is
    // enforced by a trigger that every write path passes through.
    expect(sql).toContain("create or replace function public.enforce_wallet_covers_signals");
    expect(sql).toContain("before update of wallet_budget on public.people");
    expect(sql).toContain("wallet_below_committed_signals");
    expect(sql).toContain("from public.signals");
  });

  it("moves the bootstrapped event onto the pancake currency", () => {
    const sql = readFileSync(investmentProgressMigrationPath, "utf8");
    expect(sql).toContain("update public.events");
    expect(sql).toContain("set currency = '🥞'");
    expect(sql).toContain("where slug = 'ai-build-week'");
    expect(sql).toContain("and currency = '$'");
  });
  it("keeps the pancake market private and atomic", () => {
    const sql = readFileSync(pancakeMarketMigrationPath, "utf8").toLowerCase();

    expect(sql).toContain("create table public.pancake_packages");
    expect(sql).toContain("create table public.team_pancake_selections");
    expect(sql).toContain(
      "alter table public.pancake_packages enable row level security",
    );
    expect(sql).toContain(
      "alter table public.team_pancake_selections enable row level security",
    );
    expect(sql).toContain(
      "create or replace function public.save_pancake_catalog",
    );
    expect(sql).toContain(
      "create or replace function public.select_pancake_package",
    );
    expect(sql).toContain("status = 'released'");
    expect(sql).toContain("public.current_person_id");
    expect(sql).toContain("public.is_organizer");
    expect(sql).toContain(
      "membership.event_id = pancake_packages.event_id",
    );
    expect(sql).toContain(
      "public.current_person_id(pancake_packages.event_id)",
    );
    expect(sql).toContain(
      "create or replace function public.remove_person",
    );
    expect(sql).toContain(
      "person_with_pancake_selection_cannot_be_removed",
    );
    expect(
      sql.match(
        /update public\.events\s+set updated_at = now\(\)\s+where id = target_event_id;/g,
      ),
    ).toHaveLength(2);
    expect(sql).toContain(
      "revoke insert, update, delete on public.pancake_packages",
    );
    expect(sql).toContain(
      "revoke insert, update, delete on public.team_pancake_selections",
    );
    expect(sql).not.toContain(
      "alter publication supabase_realtime add table public.pancake_packages",
    );
    expect(sql).not.toContain(
      "alter publication supabase_realtime add table public.team_pancake_selections",
    );
  });

});
