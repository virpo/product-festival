import { describe, expect, it, vi } from "vitest";
import { SupabaseFestivalRepository } from "./supabase-repository";

const event = {
  id: "event-1",
  name: "AI Build Week Product Festival",
  slug: "ai-build-week",
  status: "open",
  currency: "🥞",
  wallet_default: 100,
  max_per_team: 50,
  coverage_target: 75,
  opens_at: "2026-07-24T10:00:00Z",
  locks_at: "2026-07-24T15:00:00Z",
  results_released_at: null,
  created_at: "2026-07-24T00:00:00Z",
  updated_at: "2026-07-24T00:00:00Z",
};

/**
 * The projector opens the wall anonymously, so `getSnapshot` returns after the
 * event/teams/stats reads. This is the only path that exercises `mapStats`
 * against a real snake_case row.
 */
function clientWithStats(statsRow: Record<string, unknown> | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    channel: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "event_stats") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: statsRow, error: null }),
        };
      }

      if (table === "teams") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: event, error: null }),
      };
    }),
  };
}

describe("SupabaseFestivalRepository stats mapping", () => {
  it("maps the investment-progress columns off the wire", async () => {
    const repo = new SupabaseFestivalRepository(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clientWithStats({
        event_id: "event-1",
        people_count: 12,
        active_people: 8,
        team_count: 4,
        visit_count: 20,
        signal_count: 9,
        feedback_count: 9,
        recording_count: 3,
        total_invested: 640,
        budget_total: 1200,
        budget_distributed: 640,
        budget_remaining: 560,
        budget_distributed_percent: 53,
        coverage_qualified_people: 5,
        coverage_percent: 41,
        average_coverage: 2.5,
        role_participation: { participant: 7, mentor: 1 },
        updated_at: "2026-07-24T12:00:00Z",
      }) as any,
      { eventSlug: "ai-build-week" },
    );

    const snapshot = await repo.getSnapshot();

    // A typo in any of these keys would silently map to 0 and make the wall
    // treat a live event as pre-migration.
    expect(snapshot.stats).toMatchObject({
      budgetTotal: 1200,
      budgetDistributed: 640,
      budgetRemaining: 560,
      budgetDistributedPercent: 53,
      totalInvested: 640,
    });
  });

  it("returns null stats when the row is absent", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new SupabaseFestivalRepository(clientWithStats(null) as any, {
      eventSlug: "ai-build-week",
    });

    await expect(repo.getSnapshot()).resolves.toMatchObject({ stats: null });
  });
});
