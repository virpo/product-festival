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
  useState,
  type ReactNode,
} from "react";
import { createFestivalRepository } from "./create-repository";
import type {
  FestivalRepository,
  SavePersonInput,
  SaveTeamInput,
} from "./FestivalRepository";

type FestivalContextValue = {
  repository: FestivalRepository | null;
  mode: "demo" | "supabase";
  snapshot: FestivalSnapshot | null;
  currentPerson: Person | null;
  loading: boolean;
  error: string;
  commands: {
    refresh(): Promise<void>;
    claimPerson(code: string): Promise<void>;
    signOut(): Promise<void>;
    touchPresence(personId: string): Promise<void>;
    markVisit(personId: string, teamId: string): Promise<void>;
    upsertSignal(input: SignalInput, audio?: Blob | null): Promise<void>;
    removeSignal(investorId: string, teamId: string): Promise<void>;
    saveTeam(input: SaveTeamInput): Promise<void>;
    removeTeam(teamId: string): Promise<void>;
    savePerson(input: SavePersonInput): Promise<void>;
    removePerson(personId: string): Promise<void>;
    assignPersonToTeam(personId: string, teamId: string | null): Promise<void>;
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

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setRepository(createFestivalRepository(window.localStorage));
    }, 0);
    return () => window.clearTimeout(initialize);
  }, []);

  const refresh = useCallback(async () => {
    if (!repository) {
      return;
    }

    try {
      const [nextSnapshot, nextPerson] = await Promise.all([
        repository.getSnapshot(),
        repository.getCurrentPerson(),
      ]);
      setSnapshot(nextSnapshot);
      setCurrentPerson(nextPerson);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Nepodarilo sa načítať dáta.",
      );
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    if (!repository) {
      return;
    }

    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const unsubscribe = repository.subscribe(() => void refresh());
    return () => {
      window.clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [refresh, repository]);

  const currentPersonId = currentPerson?.id;

  useEffect(() => {
    if (!repository || !currentPersonId) {
      return;
    }

    const touch = () => void repository.touchPresence(currentPersonId);
    const initialTouch = window.setTimeout(touch, 0);
    const heartbeat = window.setInterval(touch, 2 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTouch);
      window.clearInterval(heartbeat);
    };
  }, [currentPersonId, repository]);

  const commands = useMemo<FestivalContextValue["commands"]>(() => {
    async function run(action: () => Promise<unknown>) {
      if (!repository) {
        throw new Error("Festival sa ešte načítava.");
      }

      await action();
      await refresh();
    }

    return {
      refresh,
      async claimPerson(code) {
        await run(() => repository!.claimPerson(code));
      },
      async signOut() {
        await run(() => repository!.signOut());
      },
      async touchPresence(personId) {
        await run(() => repository!.touchPresence(personId));
      },
      async markVisit(personId, teamId) {
        await run(() => repository!.markVisit(personId, teamId));
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
      async assignPersonToTeam(personId, teamId) {
        await run(() => repository!.assignPersonToTeam(personId, teamId));
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
  }, [refresh, repository]);

  const value = useMemo<FestivalContextValue>(
    () => ({
      repository,
      mode: repository?.mode ?? "demo",
      snapshot,
      currentPerson,
      loading,
      error,
      commands,
    }),
    [commands, currentPerson, error, loading, repository, snapshot],
  );

  return (
    <FestivalContext.Provider value={value}>
      {children}
    </FestivalContext.Provider>
  );
}
