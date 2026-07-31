"use client";

import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
  SignalInput,
  SignalSaveResult,
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
  privateBonusTotal: number;
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
    upsertSignal(input: SignalInput, audio?: Blob | null): Promise<SignalSaveResult>;
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
  const [privateBonusTotal, setPrivateBonusTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>({
    status: "connecting",
    stale: false,
  });
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const recoverRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const drainRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const snapshotDirty = useRef(false);
  const draining = useRef(false);
  const mounted = useRef(true);
  // Counts started fetches, so a writer can tell whether the request it is
  // looking at began before or after its own write.
  const fetchStarts = useRef(0);
  const lastInvalidationRefresh = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const retryAction = useRef<() => void>(() => undefined);
  const realtimeState = useRef<"connecting" | "connected" | "disconnected">(
    "connecting",
  );

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
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

    // This fetch observes everything committed up to now.
    snapshotDirty.current = false;
    fetchStarts.current += 1;
    const request = (async () => {

      const [nextSnapshot, nextPerson, nextBonusTotal] = await Promise.all([
        repository.getSnapshot(),
        repository.getCurrentPerson(),
        repository.getPrivateBonusTotal?.().catch(() => 0) ?? Promise.resolve(0),
      ]);
      setSnapshot(nextSnapshot);
      setCurrentPerson(nextPerson);
      setPrivateBonusTotal(nextBonusTotal);
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
        // Something landed while these queries were running, so they may have
        // read the database before it committed. Draining is serialized rather
        // than a single queued promise: a lone sentinel suppressed its own
        // successor, which stranded the dirty flag and let a writer resolve on
        // a pre-write snapshot.
        if (snapshotDirty.current) {
          void drainRef.current();
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
    // Wait out any request that began before this write: its snapshot cannot
    // contain the write, so joining it would let the caller report success on
    // pre-write state. A new fetch bumps `fetchStarts`, which is the signal that
    // the request now in flight is safe to join.
    const startedBefore = fetchStarts.current;
    for (;;) {
      const pending = refreshInFlight.current;
      if (!pending || fetchStarts.current !== startedBefore) {
        break;
      }
      await pending.catch(() => undefined);
    }

    await refreshWithRecovery();
  }, [refreshWithRecovery]);

  // Keep fetching while changes keep arriving mid-fetch, one at a time, at the
  // pace the invalidation path already uses. Writes do not come through here:
  // `refreshAfterWrite` stays immediate.
  const drainDirty = useCallback(async () => {
    if (draining.current) {
      return;
    }
    draining.current = true;
    try {
      while (snapshotDirty.current) {
        // Share the throttle with `invalidate`. Without this, a snapshot slow
        // enough to overlap the next event lets every fetch be dirtied and
        // immediately followed by another, which is sustained traffic rather
        // than one refetch per interval.
        const wait =
          INVALIDATION_MIN_INTERVAL_MS -
          (Date.now() - lastInvalidationRefresh.current);
        if (wait > 0) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, wait);
          });
          if (!mounted.current) {
            return;
          }
        }

        snapshotDirty.current = false;
        lastInvalidationRefresh.current = Date.now();

        try {
          await recoverRef.current();
        } catch {
          // Recovery already scheduled a backoff retry, and that retry performs
          // a full snapshot which covers this change. Looping here would refetch
          // immediately and defeat the pacing during an outage.
          return;
        }
      }
    } finally {
      draining.current = false;
    }
  }, []);

  useEffect(() => {
    recoverRef.current = refreshWithRecovery;
    drainRef.current = drainDirty;
    retryAction.current = () => {
      void refreshWithRecovery().catch(() => undefined);
    };
  }, [drainDirty, refreshWithRecovery]);

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
    async function run<T>(action: () => Promise<T>): Promise<T> {
      if (!repository) {
        throw new Error("Festival sa ešte načítava.");
      }

      return runCommand(action, refreshAfterWrite);
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
        return run(() => repository!.upsertSignal(input, audio));
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
      privateBonusTotal,
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
      privateBonusTotal,
      snapshot,
    ],
  );

  return (
    <FestivalContext.Provider value={value}>
      {children}
    </FestivalContext.Provider>
  );
}
