"use client";

import { AppShell } from "@/components/brand/AppShell";
import { TeamReceipt } from "@/components/results/TeamReceipt";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ResultsPage() {
  const { commands, currentPerson, error, mode, snapshot } = useFestival();
  const ownTeamId =
    currentPerson &&
    snapshot?.teamMembers.find((item) => item.personId === currentPerson.id)?.teamId;
  const [adminTeamId, setAdminTeamId] = useState<string | null>(null);

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Načítavam feedback…"
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

  const teamId =
    currentPerson.role === "organizer"
      ? adminTeamId ?? snapshot.teams.find((team) => !team.archived)?.id
      : ownTeamId;
  const team = snapshot.teams.find((item) => item.id === teamId);

  return (
    <AppShell mode={mode}>
      <Link className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={17} /> Domov
      </Link>
      {currentPerson.role === "organizer" ? (
        <label className="receipt-team-picker">
          Tím
          <select
            className="field-select"
            onChange={(event) => setAdminTeamId(event.target.value)}
            value={teamId ?? ""}
          >
            {snapshot.teams.filter((item) => !item.archived).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {team ? (
        <TeamReceipt snapshot={snapshot} team={team} viewer={currentPerson} />
      ) : (
        <main className="route-message">
          <h1>Nemáš priradený tím.</h1>
          <p>Organizátor ti ho vie doplniť v administrácii.</p>
        </main>
      )}
    </AppShell>
  );
}
