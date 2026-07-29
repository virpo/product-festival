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

  useEffect(() => {
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
      if (!active || invalidationTimer !== null) {
        return;
      }

      invalidationTimer = window.setTimeout(() => {
        invalidationTimer = null;
        if (!active) {
          return;
        }
        void refreshWithRecovery().catch(() => undefined);
      }, 50);
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

    return () => {
      active = false;
      window.clearTimeout(initialLoad);
      if (invalidationTimer !== null) {
        window.clearTimeout(invalidationTimer);
      }
      clearRetryTimer();
      window.removeEventListener("online", handleOnline);
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

    const touch = () => {
      void runCommand(
        () => repository.touchPresence(currentPersonId),
        refreshWithRecovery,
      ).catch(() => undefined);
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

      await runCommand(action, refreshWithRecovery);
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
  }, [refreshWithRecovery, repository, retryNow]);

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
