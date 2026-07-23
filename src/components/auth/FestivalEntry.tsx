"use client";

import Link from "next/link";
import { ArrowRight, LogOut, ScanLine, Settings2, WalletCards } from "lucide-react";
import { AppShell } from "@/components/brand/AppShell";
import { useFestival } from "@/lib/repository/useFestival";
import { JoinScreen } from "./JoinScreen";

export function FestivalEntry() {
  const {
    commands,
    currentPerson,
    error,
    loading,
    mode,
    snapshot,
  } = useFestival();

  if (loading || !snapshot) {
    return (
      <AppShell mode={mode}>
        <main className="loading-state">
          <span />
          <p>Pripravujem festival…</p>
        </main>
      </AppShell>
    );
  }

  if (!currentPerson) {
    return (
      <AppShell mode={mode}>
        <JoinScreen mode={mode} onJoin={commands.claimPerson} />
      </AppShell>
    );
  }

  return (
    <AppShell mode={mode}>
      <main className="home-layout">
        <section>
          <p className="eyebrow">{snapshot.event.name}</p>
          <h1>Ahoj, {currentPerson.name}.</h1>
          <p className="lede">
            Festival je {snapshot.event.status === "open" ? "otvorený" : "zatvorený"}.
            Vyber si, kam ideš ďalej.
          </p>
        </section>
        <section className="home-actions">
          {currentPerson.role === "organizer" ? (
            <Link className="primary-button" href="/admin">
              <Settings2 aria-hidden="true" size={20} />
              Riadenie festivalu
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ) : (
            <>
              <Link className="primary-button" href="/scan">
                <ScanLine aria-hidden="true" size={20} />
                Skenovať QR kód
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link className="secondary-button" href="/portfolio">
                <WalletCards aria-hidden="true" size={19} />
                Moje investície
              </Link>
            </>
          )}
          <button
            className="text-button"
            onClick={() => void commands.signOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
            Odísť z demo účtu
          </button>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
