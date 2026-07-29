"use client";

import { PublicSummary } from "@/components/results/PublicSummary";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { useFestival } from "@/lib/repository/useFestival";

export default function SummaryPage() {
  const { commands, error, snapshot } = useFestival();

  if (!snapshot) {
    return (
      <InitialLoadState
        error={error}
        label="Počítam výsledky…"
        onRetry={commands.refresh}
        variant="wall"
      />
    );
  }

  return <PublicSummary event={snapshot.event} stats={snapshot.stats} />;
}
