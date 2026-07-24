"use client";

import { AppShell } from "@/components/brand/AppShell";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <main className="route-message">
        <p className="eyebrow">Niečo sa pokazilo</p>
        <h1>Dáta sa nepodarilo načítať.</h1>
        <p>{error.message}</p>
        <button className="primary-button" onClick={reset} type="button">
          Skúsiť znova
        </button>
      </main>
    </AppShell>
  );
}
