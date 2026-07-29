import { describe, expect, it, vi } from "vitest";
import { SupabaseFestivalRepository } from "./supabase-repository";

const EVENT_ROW = {
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

// How the reconciliation lookup that runs after a failed `save_signal` behaves:
// the database adopted the new upload, it provably did not, or the lookup itself
// failed so the outcome is unknown.
type Reconciliation = "adopted" | "rejected" | "unknown";

// `upsertSignal` needs the events row, before/after signals lookups, storage
// upload/remove and the `save_signal` RPC, so the shared fake client in
// supabase-repository.test.ts does not cover this path.
function fakeClient(options: {
  rpcError: { message: string };
  reconciliation: Reconciliation;
}) {
  const remove = vi.fn().mockResolvedValue({ data: null, error: null });
  let uploadedPath: string | null = null;
  let signalLookups = 0;

  const upload = vi.fn((path: string) => {
    uploadedPath = path;
    return Promise.resolve({ data: null, error: null });
  });

  function signalLookup() {
    signalLookups += 1;

    // The first lookup is the pre-write "existing signal" read.
    if (signalLookups === 1) {
      return Promise.resolve({ data: null, error: null });
    }

    if (options.reconciliation === "unknown") {
      return Promise.resolve({ data: null, error: { message: "offline" } });
    }
    if (options.reconciliation === "adopted") {
      return Promise.resolve({
        data: { audio_path: uploadedPath },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  const client = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: "auth-1" } } } }),
    },
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        single: vi.fn().mockResolvedValue({ data: EVENT_ROW, error: null }),
        maybeSingle: vi.fn(signalLookup),
      };
      return builder;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: options.rpcError }),
    storage: {
      from: vi.fn(() => ({ upload, remove, createSignedUrl: vi.fn() })),
    },
  };

  return { client, remove, upload };
}

async function saveWithAudio(client: unknown) {
  const repository = new SupabaseFestivalRepository(client as never, {
    eventSlug: "ai-build-week",
  });

  return repository.upsertSignal(
    {
      investorId: "person-1",
      teamId: "team-1",
      amount: 10,
      feedbackText: "",
      audioPath: "pending-recording",
    } as never,
    new Blob(["recording"], { type: "audio/webm" }),
  );
}

describe("upsertSignal audio cleanup", () => {
  it("keeps the recording when the database already committed it", async () => {
    // A lost response for a transaction that committed: deleting the object here
    // would leave a stored signal pointing at a missing recording.
    const { client, remove, upload } = fakeClient({
      rpcError: { message: "TypeError: Failed to fetch" },
      reconciliation: "adopted",
    });

    await expect(saveWithAudio(client)).rejects.toThrow();

    expect(upload).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps the recording when the outcome cannot be determined", async () => {
    const { client, remove } = fakeClient({
      rpcError: { message: "TypeError: Failed to fetch" },
      reconciliation: "unknown",
    });

    await expect(saveWithAudio(client)).rejects.toThrow();

    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the orphaned recording when the database rejected the write", async () => {
    const { client, remove } = fakeClient({
      rpcError: { message: "over_budget" },
      reconciliation: "rejected",
    });

    await expect(saveWithAudio(client)).rejects.toThrow();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
