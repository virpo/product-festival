import { describe, expect, it, vi } from "vitest";
import { SupabaseFestivalRepository } from "./supabase-repository";

type RepositoryClient = ConstructorParameters<
  typeof SupabaseFestivalRepository
>[0];

const event = {
  id: "event-1",
  name: "Festival",
  slug: "ai-build-week",
  status: "released",
  currency: "🥞",
  wallet_default: 100,
  max_per_team: 50,
  coverage_target: 75,
  opens_at: null,
  locks_at: null,
  results_released_at: "2026-07-31T12:00:00Z",
  created_at: "2026-07-31T09:00:00Z",
  updated_at: "2026-07-31T12:00:00Z",
};

function resolvedQuery(data: unknown) {
  const response = { data, error: null };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    single: vi.fn().mockResolvedValue(response),
    then: (resolve: (value: typeof response) => unknown) =>
      Promise.resolve(response).then(resolve),
  };
  return query;
}

function marketClient(): RepositoryClient {
  const rows: Record<string, unknown> = {
    events: event,
    teams: [],
    event_stats: null,
    people: [],
    access_codes: [],
    team_members: [],
    visits: [],
    signals: [],
    pancake_packages: [
      {
        id: "package-1",
        event_id: "event-1",
        name: "Nugát",
        price: 700,
        position: 1,
      },
    ],
    team_pancake_selections: [
      {
        id: "selection-1",
        event_id: "event-1",
        team_id: "team-1",
        package_id: "package-1",
        selected_by: "person-1",
        selected_at: "2026-07-31T12:30:00Z",
      },
    ],
  };
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "auth-1" } } },
      }),
    },
    from: vi.fn((table: string) => resolvedQuery(rows[table])),
  } as unknown as RepositoryClient;
}

describe("SupabaseFestivalRepository pancake market mapping", () => {
  it("maps private package and selection rows for authenticated snapshots", async () => {
    const repository = new SupabaseFestivalRepository(marketClient(), {
      eventSlug: "ai-build-week",
    });

    const snapshot = await repository.getSnapshot();

    expect(snapshot.pancakePackages).toEqual([
      {
        id: "package-1",
        eventId: "event-1",
        name: "Nugát",
        price: 700,
        position: 1,
      },
    ]);
    expect(snapshot.pancakeSelections).toEqual([
      {
        id: "selection-1",
        eventId: "event-1",
        teamId: "team-1",
        packageId: "package-1",
        selectedBy: "person-1",
        selectedAt: "2026-07-31T12:30:00Z",
      },
    ]);
  });
});
