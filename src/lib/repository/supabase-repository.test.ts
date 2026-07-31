import { describe, expect, it, vi } from "vitest";
import {
  AUDIO_URL_TTL_SECONDS,
  AccessCodeInUseError,
  SupabaseFestivalRepository,
} from "./supabase-repository";

function fakeClient() {
  let subscriptionStatusListener:
    | ((status: string) => void)
    | undefined;
  const event = {
    id: "event-1",
    name: "AI Build Week Product Festival",
    slug: "ai-build-week",
    status: "open",
    currency: "$",
    wallet_default: 100,
    max_per_team: 50,
    coverage_target: 75,
    opens_at: "2026-07-24T10:00:00Z",
    locks_at: "2026-07-24T15:00:00Z",
    results_released_at: null,
    created_at: "2026-07-24T00:00:00Z",
    updated_at: "2026-07-24T00:00:00Z",
  };
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((listener?: (status: string) => void) => {
      subscriptionStatusListener = listener;
      return channel;
    }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "auth-1" } } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnValue(channel),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: event, error: null }),
    }),
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
  return {
    client,
    channel,
    event,
    emitSubscriptionStatus(status: string) {
      subscriptionStatusListener?.(status);
    },
  };
}

describe("SupabaseFestivalRepository", () => {
  it("keeps freshly loaded audio links alive for the full festival", () => {
    expect(AUDIO_URL_TTL_SECONDS).toBe(6 * 60 * 60);
  });

  it("claims through anonymous auth then claim_person RPC", async () => {
    const { client } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    const person = await repository.claimPerson("PETER");

    expect(client.auth.signInAnonymously).toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith("claim_person", {
      allow_takeover: false,
      claim_code: "PETER",
      claim_event_slug: "ai-build-week",
    });
    expect(person.name).toBe("Peter");
  });

  it("replaces a deleted anonymous identity and retries the claim once", async () => {
    const { client } = fakeClient();
    client.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: "deleted-auth-user" } } },
    });
    client.rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23503",
          message:
            'insert or update on table "people" violates foreign key constraint "people_auth_user_id_fkey"',
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "person-1",
          event_id: "event-1",
          name: "Peter",
          role: "participant",
          wallet_budget: 100,
          access_code: "PETER",
          auth_user_id: "auth-2",
          last_seen_at: null,
          created_at: "2026-07-24T00:00:00Z",
        },
        error: null,
      });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    const person = await repository.claimPerson("PETER");

    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(client.auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(client.rpc).toHaveBeenCalledTimes(2);
    expect(person.authUserId).toBe("auth-2");
  });

  it("maps an occupied access code to a typed takeover error", async () => {
    const { client } = fakeClient();
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "access_code_in_use" },
    });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await expect(repository.claimPerson("PETER")).rejects.toBeInstanceOf(
      AccessCodeInUseError,
    );
  });

  it("explicitly takes over an occupied identity", async () => {
    const { client } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await repository.claimPerson("PETER", { takeover: true });

    expect(client.rpc).toHaveBeenCalledWith("claim_person", {
      allow_takeover: true,
      claim_code: "PETER",
      claim_event_slug: "ai-build-week",
    });
  });

  it("saves a person, access code, and membership in one RPC", async () => {
    const { client } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await repository.savePerson({
      id: "person-1",
      name: " Peter ",
      role: "participant",
      walletBudget: 120,
      accessCode: " peter ",
      teamId: "team-2",
    });

    expect(client.rpc).toHaveBeenCalledWith("save_person", {
      target_access_code: "PETER",
      target_event_id: "event-1",
      target_name: "Peter",
      target_person_id: "person-1",
      target_role: "participant",
      target_team_id: "team-2",
      target_wallet_budget: 120,
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("updates editable event settings through one RPC", async () => {
    const { client, event } = fakeClient();
    client.rpc.mockResolvedValueOnce({
      data: { ...event, name: "Friday Festival" },
      error: null,
    });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await repository.updateEvent({
      name: "Friday Festival",
      currency: "$",
      walletDefault: 120,
      maxPerTeam: 60,
      coverageTarget: 80,
      locksAt: "2026-07-31T13:00:00Z",
    });

    expect(client.rpc).toHaveBeenCalledWith("update_event_settings", {
      target_coverage_target: 80,
      target_currency: "$",
      target_event_id: "event-1",
      target_locks_at: "2026-07-31T13:00:00Z",
      target_max_per_team: 60,
      target_name: "Friday Festival",
      target_wallet_default: 120,
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("records the authenticated visitor through one RPC", async () => {
    const { client } = fakeClient();
    client.rpc.mockResolvedValueOnce({ data: null, error: null });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await repository.markVisit("team-2");

    expect(client.rpc).toHaveBeenCalledWith("record_visit", {
      target_event_id: "event-1",
      target_team_id: "team-2",
    });
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("subscribes to shared room state and reports connection changes", () => {
    const {
      client,
      channel,
      emitSubscriptionStatus,
    } = fakeClient();
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });
    const connectionListener = vi.fn();

    repository.subscribe(vi.fn(), connectionListener);

    expect(channel.on).toHaveBeenCalledTimes(5);
    expect(channel.on.mock.calls.map((call) => call[1].table)).toEqual([
      "events",
      "event_stats",
      "teams",
      "people",
      "team_members",
    ]);

    emitSubscriptionStatus("SUBSCRIBED");
    emitSubscriptionStatus("TIMED_OUT");
    emitSubscriptionStatus("CHANNEL_ERROR");

    expect(connectionListener.mock.calls).toEqual([
      ["connected"],
      ["disconnected"],
      ["disconnected"],
    ]);
  });
  it("saves a validated pancake catalogue through one RPC", async () => {
    const { client } = fakeClient();
    client.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "package-1",
          event_id: "event-1",
          name: "Nugát",
          price: 700,
          position: 1,
        },
      ],
      error: null,
    });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });
    const packages = [
      { name: "Nugát", price: 700, position: 1 },
      { name: "Orechy", price: 600, position: 2 },
      { name: "Tvaroh", price: 500, position: 3 },
      { name: "Mak", price: 400, position: 4 },
      { name: "Káva", price: 300, position: 5 },
      { name: "Gaštan", price: 200, position: 6 },
      { name: "Bryndza", price: 100, position: 7 },
    ];

    await expect(repository.savePancakeCatalog(packages)).resolves.toEqual([
      {
        id: "package-1",
        eventId: "event-1",
        name: "Nugát",
        price: 700,
        position: 1,
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith("save_pancake_catalog", {
      target_event_id: "event-1",
      target_packages: packages,
    });
  });

  it("selects a pancake package through one team-scoped RPC", async () => {
    const { client } = fakeClient();
    client.rpc.mockResolvedValueOnce({
      data: {
        id: "selection-1",
        event_id: "event-1",
        team_id: "team-1",
        package_id: "package-7",
        selected_by: "person-1",
        selected_at: "2026-07-31T12:00:00Z",
      },
      error: null,
    });
    const repository = new SupabaseFestivalRepository(client as never, {
      eventSlug: "ai-build-week",
    });

    await expect(
      repository.selectPancakePackage("package-7"),
    ).resolves.toMatchObject({
      teamId: "team-1",
      packageId: "package-7",
      selectedBy: "person-1",
    });
    expect(client.rpc).toHaveBeenCalledWith("select_pancake_package", {
      target_event_id: "event-1",
      target_package_id: "package-7",
    });
  });
});
