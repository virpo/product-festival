"use client";

import { QrSheet } from "@/components/admin/QrSheet";
import { AppShell } from "@/components/brand/AppShell";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminQrPage() {
  const { commands, currentPerson, error, mode, snapshot } = useFestival();
  const origin =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Generujem QR kódy…"
          onRetry={commands.refresh}
        />
      </AppShell>
    );
  }

  if (currentPerson?.role !== "organizer") {
    return (
      <AppShell mode={mode}>
        <main className="route-message">
          <h1>Sem patrí organizátor.</h1>
          <Link className="primary-button" href="/">Späť</Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell mode={mode}>
      <Link className="back-link no-print" href="/admin">
        <ArrowLeft aria-hidden="true" size={17} /> Administrácia
      </Link>
      <QrSheet
        event={snapshot.event}
        origin={origin}
        teams={snapshot.teams.filter((team) => !team.archived)}
      />
    </AppShell>
  );
}
