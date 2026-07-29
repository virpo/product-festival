import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoSnapshot } from "./demo-data";
import type { FestivalRepository } from "./FestivalRepository";
import { FestivalProvider } from "./repository-context";
import { useFestival } from "./useFestival";

const repositoryState = vi.hoisted(() => ({
  current: null as FestivalRepository | null,
}));

vi.mock("./create-repository", () => ({
  createFestivalRepository: () => repositoryState.current,
}));

function Probe() {
  const { connection, error, snapshot } = useFestival();

  return (
    <div>
      <span>{snapshot ? "ready" : "empty"}</span>
      <span>{connection.status}</span>
      <span>{error}</span>
    </div>
  );
}

describe("FestivalProvider retry recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    repositoryState.current = null;
  });

  it("recovers an initial failure after the first backoff", async () => {
    const snapshot = createDemoSnapshot();
    const getSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue(snapshot);
    const subscribe = vi.fn(
      (
        _listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    repositoryState.current = {
      mode: "supabase",
      getSnapshot,
      getCurrentPerson: vi.fn().mockResolvedValue(null),
      subscribe,
      claimPerson: vi.fn(),
      signOut: vi.fn(),
      touchPresence: vi.fn(),
      markVisit: vi.fn(),
      upsertSignal: vi.fn(),
      removeSignal: vi.fn(),
      saveTeam: vi.fn(),
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <Probe />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("retrying")).toBeInTheDocument();
    expect(screen.getByText("Network unavailable")).toBeInTheDocument();

    // Reconnect delays carry jitter, so advance past the top of the envelope.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });

    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.queryByText("Network unavailable")).not.toBeInTheDocument();
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("refetches when an invalidation arrives during an in-flight refresh", async () => {
    const snapshot = createDemoSnapshot();
    let releaseFirst: () => void = () => undefined;
    const getSnapshot = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve(snapshot);
          }),
      )
      .mockResolvedValue(snapshot);

    let invalidate: () => void = () => undefined;
    const subscribe = vi.fn(
      (
        listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        invalidate = listener;
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    repositoryState.current = {
      mode: "supabase",
      getSnapshot,
      getCurrentPerson: vi.fn().mockResolvedValue(null),
      subscribe,
      claimPerson: vi.fn(),
      signOut: vi.fn(),
      touchPresence: vi.fn(),
      markVisit: vi.fn(),
      upsertSignal: vi.fn(),
      removeSignal: vi.fn(),
      saveTeam: vi.fn(),
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <Probe />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The first snapshot is still in flight and must not be duplicated.
    expect(getSnapshot).toHaveBeenCalledTimes(1);

    // Realtime reports a change those queries may have read past.
    await act(async () => {
      invalidate();
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(getSnapshot).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseFirst();
      await vi.advanceTimersByTimeAsync(0);
    });

    // The invalidation must produce a fetch that starts after it, rather than
    // being coalesced into the request that was already running.
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("schedules recovery when the follow-up fetch fails", async () => {
    const snapshot = createDemoSnapshot();
    let releaseFirst: () => void = () => undefined;
    const getSnapshot = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve(snapshot);
          }),
      )
      // The follow-up forced by the invalidation fails.
      .mockRejectedValueOnce(new Error("Follow-up unavailable"))
      .mockResolvedValue(snapshot);

    let invalidate: () => void = () => undefined;
    const subscribe = vi.fn(
      (
        listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        invalidate = listener;
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    repositoryState.current = {
      mode: "supabase",
      getSnapshot,
      getCurrentPerson: vi.fn().mockResolvedValue(null),
      subscribe,
      claimPerson: vi.fn(),
      signOut: vi.fn(),
      touchPresence: vi.fn(),
      markVisit: vi.fn(),
      upsertSignal: vi.fn(),
      removeSignal: vi.fn(),
      saveTeam: vi.fn(),
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <Probe />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      invalidate();
      await vi.advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      releaseFirst();
      await vi.advanceTimersByTimeAsync(0);
    });

    // A stale snapshot must never be advertised as live just because the first
    // request succeeded.
    expect(screen.getByText("retrying")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });

    expect(screen.getByText("live")).toBeInTheDocument();
  });

  it("does not refetch the snapshot for a successful presence heartbeat", async () => {
    const snapshot = createDemoSnapshot();
    const getSnapshot = vi.fn().mockResolvedValue(snapshot);
    const touchPresence = vi.fn().mockResolvedValue(undefined);

    const subscribe = vi.fn(
      (
        _listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    repositoryState.current = {
      mode: "supabase",
      getSnapshot,
      getCurrentPerson: vi
        .fn()
        .mockResolvedValue({ id: "person-1", name: "Peter" }),
      subscribe,
      claimPerson: vi.fn(),
      signOut: vi.fn(),
      touchPresence,
      markVisit: vi.fn(),
      upsertSignal: vi.fn(),
      removeSignal: vi.fn(),
      saveTeam: vi.fn(),
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <Probe />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const afterInitialLoad = getSnapshot.mock.calls.length;

    // Two heartbeats, staying under the 60s safety poll.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60 * 1_000);
    });

    expect(touchPresence.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Heartbeats must not each cost a full snapshot; only safety polls may add.
    expect(getSnapshot.mock.calls.length - afterInitialLoad).toBeLessThanOrEqual(
      5,
    );
  });

  it("coalesces presence churn into one refetch per interval", async () => {
    const snapshot = createDemoSnapshot();
    const getSnapshot = vi.fn().mockResolvedValue(snapshot);

    let invalidate: () => void = () => undefined;
    const subscribe = vi.fn(
      (
        listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        invalidate = listener;
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    repositoryState.current = {
      mode: "supabase",
      getSnapshot,
      getCurrentPerson: vi.fn().mockResolvedValue(null),
      subscribe,
      claimPerson: vi.fn(),
      signOut: vi.fn(),
      touchPresence: vi.fn(),
      markVisit: vi.fn(),
      upsertSignal: vi.fn(),
      removeSignal: vi.fn(),
      saveTeam: vi.fn(),
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <Probe />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const afterInitialLoad = getSnapshot.mock.calls.length;

    // One heartbeat per participant, spread across the throttle window.
    await act(async () => {
      for (let index = 0; index < 40; index += 1) {
        invalidate();
        await vi.advanceTimersByTimeAsync(60);
      }
    });

    // Without throttling each heartbeat would cost a full snapshot.
    expect(getSnapshot.mock.calls.length - afterInitialLoad).toBeLessThanOrEqual(
      2,
    );
  });
});
