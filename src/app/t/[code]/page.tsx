"use client";

import { AppShell } from "@/components/brand/AppShell";
import { SignalForm } from "@/components/participant/SignalForm";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { isOwnTeam } from "@/lib/domain/rules";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function TeamPage() {
  const params = useParams<{ code: string }>();
  const { commands, currentPerson, error, mode, snapshot } = useFestival();
  const visitMarked = useRef(false);
  const code = decodeURIComponent(params.code ?? "").toUpperCase();
  const team = snapshot?.teams.find(
    (item) => !item.archived && item.code.toUpperCase() === code,
  );

  useEffect(() => {
    if (
      !team ||
      !currentPerson ||
      !snapshot ||
      snapshot.event.status !== "open" ||
      isOwnTeam(currentPerson.id, team.id, snapshot) ||
      visitMarked.current
    ) {
      return;
    }
    visitMarked.current = true;
    // `record_visit` is an idempotent upsert, so a failed attempt must not stay
    // marked as done — otherwise a scan during a brief outage silently loses the
    // visit for the lifetime of this page. Releasing the guard lets the next
    // snapshot refresh retry it.
    void commands.markVisit(team.id).catch(() => {
      visitMarked.current = false;
    });
  }, [commands, currentPerson, snapshot, team]);

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
