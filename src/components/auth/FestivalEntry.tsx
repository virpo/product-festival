"use client";

import Link from "next/link";
import { ArrowRight, LogOut, Settings2 } from "lucide-react";
import { AppShell } from "@/components/brand/AppShell";
import { ParticipantHome } from "@/components/participant/ParticipantHome";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";
import { JoinScreen } from "./JoinScreen";

export function FestivalEntry() {
  const {
    commands,
    currentPerson,
    error,
    mode,
    snapshot,
  } = useFestival();

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Pripravujem festival…"
          onRetry={commands.refresh}
        />
      </AppShell>
    );
  }

  if (!currentPerson) {
    return (
      <AppShell mode={mode}>
        <JoinScreen
          mode={mode === "demo" ? "demo" : "live"}
          onJoin={commands.claimPerson}
        />
      </AppShell>
    );
  }

  return (
    <AppShell mode={mode}>
      {currentPerson.role === "organizer" ? (
        <main className="home-layout">
          <section>
            <p className="eyebrow">{snapshot.event.name}</p>
            <h1>Ahoj, {currentPerson.name}.</h1>
            <p className="lede">
              Festival je {snapshot.event.status === "open" ? "otvorený" : "zatvorený"}.
            </p>
          </section>
          <section className="home-actions">
            <Link className="primary-button" href="/admin">
              <Settings2 aria-hidden="true" size={20} />
              Riadenie festivalu
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="secondary-button" href="/wall">Otvoriť verejnú stenu</Link>
            <button
              className="text-button"
              onClick={() => void commands.signOut()}
              type="button"
            >
              <LogOut aria-hidden="true" size={17} />
              Odhlásiť sa
            </button>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </section>
        </main>
      ) : (
        <>
          <ParticipantHome person={currentPerson} snapshot={snapshot} />
          <div className="participant-signout">
            <button
              className="text-button"
              onClick={() => void commands.signOut()}
              type="button"
            >
              <LogOut aria-hidden="true" size={17} /> Odhlásiť sa
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}
