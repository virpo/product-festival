"use client";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AppShell } from "@/components/brand/AppShell";
import { useFestival } from "@/lib/repository/useFestival";
import Link from "next/link";

export default function AdminPage() {
  const { commands, currentPerson, loading, mode, snapshot } = useFestival();

  if (loading || !snapshot) {
    return (
      <AppShell mode={mode}>
        <main className="loading-state"><span /><p>Načítavam administráciu…</p></main>
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
      <AdminDashboard
        commands={commands}
        isDemo={mode === "demo"}
        snapshot={snapshot}
      />
    </AppShell>
  );
}
