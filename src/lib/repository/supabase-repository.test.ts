import { describe, expect, it, vi } from "vitest";
import { SupabaseFestivalRepository } from "./supabase-repository";

function fakeClient() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "auth-1" } } },
        error: null,
      }),
    },
    channel: vi.fn().mockReturnValue(channel),
    rpc: vi.fn().mockResolvedValue({
      data: {
        id: "person-1",
        event_id: "event-1",
        name: "Peter",
        role: "participant",
        wallet_budget: 100,
        access_code: "PETER",
        auth_user_id: "auth-1",
        last_seen_at: null,
        created_at: "2026-07-24T00:00:00Z",
      },
      error: null,
    }),
  };
  return { client, channel };
}

describe("SupabaseFestivalRepository", () => {
  it("claims through anonymous auth then claim_person RPC", async () => {
    const { client } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    const person = await repository.claimPerson("PETER");

    expect(client.auth.signInAnonymously).toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith("claim_person", {
      claim_code: "PETER",
      claim_event_slug: "ai-build-week",
    });
    expect(person.name).toBe("Peter");
  });

  it("subscribes only to event lifecycle and aggregate stats", () => {
    const { client, channel } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    repository.subscribe(vi.fn());

    expect(channel.on).toHaveBeenCalledTimes(2);
    expect(channel.on.mock.calls.map((call) => call[1].table)).toEqual([
      "events",
      "event_stats",
    ]);
  });
});
