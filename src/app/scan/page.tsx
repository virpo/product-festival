"use client";

import { AppShell } from "@/components/brand/AppShell";
import { QrScanner } from "@/components/participant/QrScanner";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ScanPage() {
  const { commands, currentPerson, error, mode, snapshot } = useFestival();

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Zapínam skener…"
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

  return (
    <AppShell mode={mode}>
      <Link className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={17} /> Domov
      </Link>
      <QrScanner />
    </AppShell>
  );
}
