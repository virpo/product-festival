"use client";

import { AppShell } from "@/components/brand/AppShell";
import { ParticipantDock } from "@/components/participant/ParticipantDock";
import { ParticipantFrame } from "@/components/participant/ParticipantFrame";
import { SignalForm } from "@/components/participant/SignalForm";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { isOwnTeam } from "@/lib/domain/rules";
import type { SignalInput } from "@/lib/domain/types";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// `record_visit` is an idempotent upsert, so retrying a failed write is safe.
// Bound the attempts so a persistently failing RPC cannot spin.
const VISIT_MAX_ATTEMPTS = 3;

export default function TeamPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
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
      <ParticipantFrame
        back={{ href: "/scan", label: "Skener" }}
        mode={mode}
        person={currentPerson}
        snapshot={snapshot}
      >
        <main className="route-message">
          <p className="eyebrow">Kód {code}</p>
          <h1>Tento tím nepoznáme.</h1>
          <Link className="primary-button" href="/scan">Skenovať znova</Link>
        </main>
      </ParticipantFrame>
    );
  }

  if (isOwnTeam(currentPerson.id, team.id, snapshot)) {
    return (
      <ParticipantFrame
        back={{ href: "/scan", label: "Skener" }}
        bottom={
          <ParticipantDock>
            <div className="overview-dock">
              <Link className="overview-primary-action" href="/scan">
                <span>
                  <small>Ďalší tím</small>
                  <strong>Skenovať QR kód</strong>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </ParticipantDock>
        }
        mode={mode}
        person={currentPerson}
        snapshot={snapshot}
      >
        <main className="route-message own-team-message">
          <p className="eyebrow">{team.name}</p>
          <h1>Toto je tvoj tím.</h1>
          <p>Do vlastného tímu neinvestuješ.</p>
        </main>
      </ParticipantFrame>
    );
  }

  const existingSignal = snapshot.signals.find(
    (signal) =>
      signal.investorId === currentPerson.id && signal.teamId === team.id,
  );
  const fromOverview = searchParams.get("from") === "overview";
  const backHref = fromOverview ? "/" : "/scan";
  const headerBackLabel = fromOverview ? "Prehľad" : "Skener";
  const formBackLabel = fromOverview ? "Prehľad" : "skener";
  const investorId = currentPerson.id;
  const teamId = team.id;
  const teamCode = team.code;

  async function save(input: SignalInput, audio?: Blob | null) {
    await commands.upsertSignal(input, audio);
    router.push(`/?saved=${encodeURIComponent(teamCode)}`);
  }

  async function remove() {
    await commands.removeSignal(investorId, teamId);
    router.push(`/?removed=${encodeURIComponent(teamCode)}`);
  }

  return (
    <ParticipantFrame
      back={{ href: backHref, label: headerBackLabel }}
      mode={mode}
      person={currentPerson}
      snapshot={snapshot}
    >
      {snapshot.event.status === "open" ? (
        <SignalForm
          backHref={backHref}
          backLabel={formBackLabel}
          existingSignal={existingSignal}
          onDelete={existingSignal ? remove : undefined}
          onSave={save}
          person={currentPerson}
          snapshot={snapshot}
          team={team}
        />
      ) : (
        <main className="route-message">
          <p className="eyebrow">{team.name}</p>
          <h1>Investovanie je uzavreté.</h1>
          <Link className="secondary-button" href="/">
            Môj prehľad
          </Link>
        </main>
      )}
    </ParticipantFrame>
  );
}
