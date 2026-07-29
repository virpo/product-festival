"use client";

import { AppShell } from "@/components/brand/AppShell";
import { SignalForm } from "@/components/participant/SignalForm";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { isOwnTeam } from "@/lib/domain/rules";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// `record_visit` is an idempotent upsert, so retrying a failed write is safe.
// Bound the attempts so a persistently failing RPC cannot spin.
const VISIT_MAX_ATTEMPTS = 3;

export default function TeamPage() {
  const params = useParams<{ code: string }>();
  const { commands, connection, currentPerson, error, mode, snapshot } =
    useFestival();
  // Keyed by person and team: this route component can be preserved across
  // `[code]` changes, and a plain boolean would then suppress the next team's
  // visit for the rest of the session.
  const visitState = useRef<{
    key: string | null;
    attempts: number;
    done: boolean;
    inFlight: boolean;
  }>({ key: null, attempts: 0, done: false, inFlight: false });
  const [visitRetry, setVisitRetry] = useState(0);
  const code = decodeURIComponent(params.code ?? "").toUpperCase();
  const team = snapshot?.teams.find(
    (item) => !item.archived && item.code.toUpperCase() === code,
  );

  const visitKey =
    currentPerson && team ? `${currentPerson.id}:${team.id}` : null;

  // A scan during a brief outage would otherwise burn the whole attempt budget
  // before the network returns and stay latched for good. Re-arm on the
  // transition back to live only, so a persistently failing RPC still cannot spin.
  const lastConnection = useRef(connection.status);
  useEffect(() => {
    if (lastConnection.current === connection.status) {
      return;
    }
    lastConnection.current = connection.status;

    if (
      connection.status === "live" &&
      visitState.current.attempts > 0 &&
      !visitState.current.done
    ) {
      visitState.current.attempts = 0;
      setVisitRetry((value) => value + 1);
    }
  }, [connection.status]);

  useEffect(() => {
    if (
      !team ||
      !currentPerson ||
      !snapshot ||
      !visitKey ||
      snapshot.event.status !== "open" ||
      isOwnTeam(currentPerson.id, team.id, snapshot)
    ) {
      return;
    }

    if (visitState.current.key !== visitKey) {
      visitState.current = {
        key: visitKey,
        attempts: 0,
        done: false,
        inFlight: false,
      };
    }

    const state = visitState.current;
    // `inFlight` matters because this effect also reruns on every snapshot
    // change, which would otherwise fire concurrent duplicate writes.
    if (state.done || state.inFlight || state.attempts >= VISIT_MAX_ATTEMPTS) {
      return;
    }

    state.inFlight = true;
    state.attempts += 1;

    void commands
      .markVisit(team.id)
      .then(() => {
        if (visitState.current.key === visitKey) {
          visitState.current.done = true;
          visitState.current.inFlight = false;
        }
      })
      .catch(() => {
        if (visitState.current.key === visitKey) {
          visitState.current.inFlight = false;
        }
        // `runCommand` awaits its recovery refresh before rejecting, so that
        // snapshot render already happened with the guard still held. Bump state
        // to rerun this effect instead of waiting for an unrelated invalidation
        // or the 60s safety poll.
        setVisitRetry((value) => value + 1);
      });
  }, [commands, currentPerson, snapshot, team, visitKey, visitRetry]);

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Hľadám tím…"
          onRetry={commands.refresh}
        />
      </AppShell>
    );
  }

  if (!currentPerson) {
    return (
      <AppShell mode={mode}>
        <main className="route-message">
          <h1>Najprv sa prihlás.</h1>
          <Link className="primary-button" href="/">Späť na vstup</Link>
        </main>
      </AppShell>
    );
  }

  if (!team) {
    return (
      <AppShell mode={mode}>
        <main className="route-message">
          <p className="eyebrow">Kód {code}</p>
          <h1>Tento tím nepoznáme.</h1>
          <Link className="primary-button" href="/scan">Skenovať znova</Link>
        </main>
      </AppShell>
    );
  }

  if (isOwnTeam(currentPerson.id, team.id, snapshot)) {
    return (
      <AppShell mode={mode}>
        <Link className="back-link" href="/scan">
          <ArrowLeft aria-hidden="true" size={17} /> Skener
        </Link>
        <main className="route-message own-team-message">
          <p className="eyebrow">{team.name}</p>
          <h1>Toto je tvoj tím.</h1>
          <p>Do vlastného tímu neinvestuješ. Choď skúsiť ďalší produkt.</p>
          <Link className="primary-button" href="/scan">Skenovať ďalší QR kód</Link>
        </main>
      </AppShell>
    );
  }

  const existingSignal = snapshot.signals.find(
    (signal) =>
      signal.investorId === currentPerson.id && signal.teamId === team.id,
  );

  return (
    <AppShell mode={mode}>
      <Link className="back-link" href="/scan">
        <ArrowLeft aria-hidden="true" size={17} /> Skener
      </Link>
      {snapshot.event.status === "open" ? (
        <SignalForm
          existingSignal={existingSignal}
          onSave={commands.upsertSignal}
          person={currentPerson}
          snapshot={snapshot}
          team={team}
        />
      ) : (
        <main className="route-message">
          <p className="eyebrow">{team.name}</p>
          <h1>Investovanie je uzavreté.</h1>
          <Link className="secondary-button" href="/portfolio">
            <Home aria-hidden="true" size={18} /> Môj prehľad
          </Link>
        </main>
      )}
    </AppShell>
  );
}
