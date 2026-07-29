"use client";

import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
  SignalInput,
} from "@/lib/domain/types";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createFestivalRepository } from "./create-repository";
import type {
  ClaimPersonOptions,
  FestivalRepository,
  SavePersonInput,
  SaveTeamInput,
} from "./FestivalRepository";
import { runCommand } from "./run-command";
import { retryDelay } from "./retry-policy";

export type ConnectionState =
  | { status: "connecting"; stale: boolean }
  | { status: "live"; stale: false }
  | {
      status: "retrying";
      stale: true;
      attempt: number;
      message: string;
    };

type FestivalContextValue = {
  repository: FestivalRepository | null;
  mode: "demo" | "supabase";
  snapshot: FestivalSnapshot | null;
  currentPerson: Person | null;
  loading: boolean;
  error: string;
  connection: ConnectionState;
  commands: {
    refresh(): Promise<void>;
    claimPerson(code: string, options?: ClaimPersonOptions): Promise<void>;
    signOut(): Promise<void>;
    touchPresence(personId: string): Promise<void>;
    markVisit(teamId: string): Promise<void>;
    upsertSignal(input: SignalInput, audio?: Blob | null): Promise<void>;
    removeSignal(investorId: string, teamId: string): Promise<void>;
    saveTeam(input: SaveTeamInput): Promise<void>;
    removeTeam(teamId: string): Promise<void>;
    savePerson(input: SavePersonInput): Promise<void>;
    removePerson(personId: string): Promise<void>;
    updateEvent(patch: Partial<FestivalEvent>): Promise<void>;
    advanceEvent(status: EventStatus): Promise<void>;
    resetDemo(): Promise<void>;
  };
};

export const FestivalContext = createContext<FestivalContextValue | null>(null);

const INVALIDATION_DEBOUNCE_MS = 50;
const INVALIDATION_MIN_INTERVAL_MS = 3_000;
// Realtime can stay nominally connected yet miss a notification. An unattended
// projector wall has no presence heartbeat and no user interaction, so without a
// slow safety refetch it can show the wrong phase for the rest of the evening.
const SAFETY_POLL_MS = 60_000;
const SAFETY_POLL_JITTER_MS = 15_000;

export function FestivalProvider({ children }: { children: ReactNode }) {
  const [repository, setRepository] =
    useState<FestivalRepository | null>(null);
  const [snapshot, setSnapshot] = useState<FestivalSnapshot | null>(null);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>({
    status: "connecting",
    stale: false,
  });
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef<Promise<void> | null>(null);
  const recoverRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const snapshotDirty = useRef(false);
  const lastInvalidationRefresh = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const retryAction = useRef<() => void>(() => undefined);
  const realtimeState = useRef<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setRepository(createFestivalRepository(window.localStorage));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (!repository) {
      return Promise.resolve();
    }

    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    snapshotDirty.current = false;

    const request = (async () => {
      const [nextSnapshot, nextPerson] = await Promise.all([
        repository.getSnapshot(),
        repository.getCurrentPerson(),
      ]);
      setSnapshot(nextSnapshot);
      setCurrentPerson(nextPerson);
      setError("");
    })()
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nepodarilo sa načítať dáta.",
        );
        throw reason;
      })
      .finally(() => {
        setLoading(false);
        if (refreshInFlight.current === request) {
          refreshInFlight.current = null;
        }
        // An invalidation landed while these queries were running, so they may
        // have read the database before that change committed. Coalescing it
        // into this request would leave the snapshot permanently behind, so run
        // exactly one follow-up fetch.
        if (snapshotDirty.current && !refreshQueued.current) {
          snapshotDirty.current = false;
          // Route the follow-up through recovery: a bare refresh would swallow
          // its failure, so this request could mark the connection live while
          // the read that actually mattered never landed.
          //
          // Stay non-null until the follow-up finishes, so a writer awaiting
          // read-your-write can observe it. `refreshInFlight` was cleared above,
          // so this starts a genuinely new fetch.
          refreshQueued.current = (async () => {
            try {
              await recoverRef.current();
            } catch {
              // Recovery owns the retry; awaiters must not see a rejection.
            } finally {
              refreshQueued.current = null;
            }
          })();
        }
      });

    refreshInFlight.current = request;
    return request;
  }, [repository]);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const markLive = useCallback(() => {
    clearRetryTimer();
    retryAttempt.current = 0;
    setConnection({ status: "live", stale: false });
  }, [clearRetryTimer]);

  const scheduleRetry = useCallback((reason: unknown) => {
    const message =
      typeof reason === "string"
        ? reason
        : "Spojenie vypadlo. Skúšam znova.";

    if (retryTimer.current !== null) {
      setConnection((current) =>
        current.status === "retrying" ? { ...current, message } : current,
      );
      return;
    }

    const attempt = retryAttempt.current + 1;
    retryAttempt.current = attempt;
    setConnection({
      status: "retrying",
      stale: true,
      attempt,
      message,
    });
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      retryAction.current();
    }, retryDelay(attempt));
  }, []);

  const refreshWithRecovery = useCallback(async () => {
    try {
      await refresh();

      if (
        repository?.mode === "demo" ||
        realtimeState.current === "connected"
      ) {
        markLive();
      } else if (realtimeState.current === "disconnected") {
        scheduleRetry("Živé aktualizácie sú odpojené.");
      }
    } catch (reason) {
      scheduleRetry(reason);
      throw reason;
    }
  }, [markLive, refresh, repository, scheduleRetry]);

  const retryNow = useCallback(async () => {
    clearRetryTimer();
    await refreshWithRecovery();
  }, [clearRetryTimer, refreshWithRecovery]);

  // A write must observe its own effect. Marking the snapshot dirty first means
  // that if a poll or invalidation refresh is already running — and may have read
  // the database before this write committed — the existing follow-up machinery
  // guarantees one more fetch afterwards instead of joining a pre-write request.
  const refreshAfterWrite = useCallback(async () => {
    snapshotDirty.current = true;
    await refreshWithRecovery();

    // Joining a request that started before the write only guarantees that a
    // follow-up gets scheduled, not that it finished. Await it too, so a caller
    // that closes a form or reports success on resolve is really looking at
    // post-write state.
    const queued = refreshQueued.current;
    if (queued) {
      await queued;
    }
  }, [refreshWithRecovery]);

  useEffect(() => {
    recoverRef.current = refreshWithRecovery;
    retryAction.current = () => {
      void refreshWithRecovery().catch(() => undefined);
    };
  }, [refreshWithRecovery]);

  useEffect(() => {
    if (!repository) {
      return;
    }

    realtimeState.current = "connecting";

    let active = true;
    let invalidationTimer: number | null = null;
    const invalidate = () => {
      // Record that the database moved even if the refetch is still throttled,
      // so an in-flight refresh cannot swallow this change.
      snapshotDirty.current = true;

      if (!active || invalidationTimer !== null) {
        return;
      }

      // Presence heartbeats write `people`, which this event publishes through
      // Realtime, so an organizer device receives one invalidation per
      // participant every two minutes and each one costs a full snapshot
      // (~10 requests). Cap invalidation-driven refetches instead of tracking
      // every heartbeat; the trailing refetch keeps the data fresh.
      const sinceLast = Date.now() - lastInvalidationRefresh.current;
      const wait = Math.max(
        INVALIDATION_DEBOUNCE_MS,
        INVALIDATION_MIN_INTERVAL_MS - sinceLast,
      );

      invalidationTimer = window.setTimeout(() => {
        invalidationTimer = null;
        if (!active) {
          return;
        }
        lastInvalidationRefresh.current = Date.now();
        void refreshWithRecovery().catch(() => undefined);
      }, wait);
    };
    const handleConnection = (status: "connected" | "disconnected") => {
      if (!active) {
        return;
      }

      realtimeState.current = status;

      if (status === "connected") {
        void refreshWithRecovery().catch(() => undefined);
      } else {
        scheduleRetry("Živé aktualizácie sú odpojené.");
      }
    };
    const initialLoad = window.setTimeout(() => {
      void refreshWithRecovery().catch(() => undefined);
    }, 0);
    const unsubscribe = repository.subscribe(invalidate, handleConnection);
    const handleOnline = () => {
      if (!active) {
        return;
      }
      void retryNow().catch(() => undefined);
    };
    window.addEventListener("online", handleOnline);

    // A phone that slept through a change reports no disconnect, so refetch as
    // soon as the screen comes back.
    const handleVisibility = () => {
      if (!active || document.visibilityState !== "visible") {
        return;
      }
      void retryNow().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const safetyPoll = window.setInterval(
      () => {
        if (!active) {
          return;
        }
        void refreshWithRecovery().catch(() => undefined);
      },
      SAFETY_POLL_MS + Math.floor(Math.random() * SAFETY_POLL_JITTER_MS),
    );

    return () => {
      active = false;
      window.clearTimeout(initialLoad);
      if (invalidationTimer !== null) {
        window.clearTimeout(invalidationTimer);
      }
      window.clearInterval(safetyPoll);
      clearRetryTimer();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
    };
  }, [
    clearRetryTimer,
    refreshWithRecovery,
    repository,
    retryNow,
    scheduleRetry,
  ]);

  const currentPersonId = currentPerson?.id;

  useEffect(() => {
    if (!repository || !currentPersonId) {
      return;
    }

    // Presence is a best-effort heartbeat, so it must not refresh on success:
    // routing it through `runCommand` cost a full snapshot (~10 requests) per
    // beat on every phone, which is most of the load this provider is trying to
    // shed. Only a failed beat is worth feeding into connection recovery.
    const touch = () => {
      void repository.touchPresence(currentPersonId).catch(() => {
        void refreshWithRecovery().catch(() => undefined);
      });
    };
    const initialTouch = window.setTimeout(touch, 0);
    const heartbeat = window.setInterval(touch, 2 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTouch);
      window.clearInterval(heartbeat);
    };
  }, [currentPersonId, refreshWithRecovery, repository]);

  const commands = useMemo<FestivalContextValue["commands"]>(() => {
    async function run(action: () => Promise<unknown>) {
      if (!repository) {
        throw new Error("Festival sa ešte načítava.");
      }

      await runCommand(action, refreshAfterWrite);
    }

    return {
      refresh: retryNow,
      async claimPerson(code, options) {
        await run(() => repository!.claimPerson(code, options));
      },
      async signOut() {
        await run(() => repository!.signOut());
      },
      async touchPresence(personId) {
        await run(() => repository!.touchPresence(personId));
      },
      async markVisit(teamId) {
        await run(() => repository!.markVisit(teamId));
      },
      async upsertSignal(input, audio) {
        await run(() => repository!.upsertSignal(input, audio));
      },
      async removeSignal(investorId, teamId) {
        await run(() => repository!.removeSignal(investorId, teamId));
      },
      async saveTeam(input) {
        await run(() => repository!.saveTeam(input));
      },
      async removeTeam(teamId) {
        await run(() => repository!.removeTeam(teamId));
      },
      async savePerson(input) {
        await run(() => repository!.savePerson(input));
      },
      async removePerson(personId) {
        await run(() => repository!.removePerson(personId));
      },
      async updateEvent(patch) {
        await run(() => repository!.updateEvent(patch));
      },
      async advanceEvent(status) {
        await run(() => repository!.advanceEvent(status));
      },
      async resetDemo() {
        await run(() => repository!.resetDemo());
      },
    };
  }, [refreshAfterWrite, repository, retryNow]);

  const value = useMemo<FestivalContextValue>(
    () => ({
      repository,
      mode: repository?.mode ?? "demo",
      snapshot,
      currentPerson,
      loading,
      error,
      connection,
      commands,
    }),
    [
      commands,
      connection,
      currentPerson,
      error,
      loading,
      repository,
      snapshot,
    ],
  );

  return (
    <FestivalContext.Provider value={value}>
      {children}
    </FestivalContext.Provider>
  );
}
