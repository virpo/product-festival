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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.queryByText("Network unavailable")).not.toBeInTheDocument();
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });
});
