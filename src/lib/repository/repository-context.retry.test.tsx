import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
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

  it("keeps a write pending until a snapshot taken after it resolves", async () => {
    const snapshot = createDemoSnapshot();
    let releaseFirst: () => void = () => undefined;
    let releaseSecond: () => void = () => undefined;
    const getSnapshot = vi
      .fn()
      // A refresh that began before the write.
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve(snapshot);
          }),
      )
      // The post-write follow-up.
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSecond = () => resolve(snapshot);
          }),
      )
      .mockResolvedValue(snapshot);

    const saveTeam = vi.fn().mockResolvedValue(undefined);
    const subscribe = vi.fn(
      (
        _listener: () => void,
        connectionListener?: (status: "connected" | "disconnected") => void,
      ) => {
        connectionListener?.("connected");
        return vi.fn();
      },
    );

    type Commands = ReturnType<typeof useFestival>["commands"];

    function CommandProbe({ onReady }: { onReady: (value: Commands) => void }) {
      const { commands } = useFestival();

      useEffect(() => {
        onReady(commands);
      }, [commands, onReady]);

      return null;
    }

    let captured: Commands | null = null;
    const handleReady = (value: Commands) => {
      captured = value;
    };

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
      saveTeam,
      removeTeam: vi.fn(),
      savePerson: vi.fn(),
      removePerson: vi.fn(),
      updateEvent: vi.fn(),
      advanceEvent: vi.fn(),
      resetDemo: vi.fn(),
    } as unknown as FestivalRepository;

    render(
      <FestivalProvider>
        <CommandProbe onReady={handleReady} />
      </FestivalProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The pre-write refresh is still open.
    expect(getSnapshot).toHaveBeenCalledTimes(1);

    let settled = false;
    const write = captured!
      .saveTeam({ name: "Tim" } as never)
      .then(() => {
        settled = true;
      });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(saveTeam).toHaveBeenCalledTimes(1);

    // Releasing only the pre-write request must not settle the command: that
    // snapshot cannot contain the write.
    await act(async () => {
      releaseFirst();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(settled).toBe(false);
    expect(getSnapshot).toHaveBeenCalledTimes(2);

    await act(async () => {
      releaseSecond();
      await write;
    });

    expect(settled).toBe(true);
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
