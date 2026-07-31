"use client";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { OrganizerHeader } from "@/components/admin/OrganizerHeader";
import { AppShell } from "@/components/brand/AppShell";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";
import Link from "next/link";

export default function AdminPage() {
  const { commands, currentPerson, error, mode, snapshot } = useFestival();

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Načítavam administráciu…"
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
    <AppShell
      header={
        <OrganizerHeader
          eventStatus={snapshot.event.status}
          name={currentPerson.name}
          onSignOut={commands.signOut}
        />
      }
      mode={mode}
    >
      <AdminDashboard
        commands={commands}
        currentPerson={currentPerson}
        isDemo={mode === "demo"}
        snapshot={snapshot}
      />
    </AppShell>
  );
}
