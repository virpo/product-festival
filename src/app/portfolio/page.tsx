"use client";

import { AppShell } from "@/components/brand/AppShell";
import { Portfolio } from "@/components/participant/Portfolio";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PortfolioPage() {
  const { commands, currentPerson, loading, mode, snapshot } = useFestival();

  if (loading || !snapshot) {
    return (
      <AppShell mode={mode}>
        <main className="loading-state"><span /><p>Načítavam prehľad…</p></main>
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

  return (
    <AppShell mode={mode}>
      <Link className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={17} /> Domov
      </Link>
      <Portfolio commands={commands} person={currentPerson} snapshot={snapshot} />
    </AppShell>
  );
}
