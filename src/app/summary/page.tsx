"use client";

import { PublicSummary } from "@/components/results/PublicSummary";
import { useFestival } from "@/lib/repository/useFestival";

export default function SummaryPage() {
  const { loading, snapshot } = useFestival();

  if (loading || !snapshot) {
    return <main className="wall-loading"><span /><p>Počítam výsledky…</p></main>;
  }

  return <PublicSummary event={snapshot.event} stats={snapshot.stats} />;
}
