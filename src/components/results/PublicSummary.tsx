import { Stripes } from "@/components/brand/Stripes";
import { formatCredits } from "@/lib/domain/credits";
import type { EventStats, FestivalEvent } from "@/lib/domain/types";

export function PublicSummary({
  event,
  stats,
}: {
  event: FestivalEvent;
  stats: EventStats | null;
}) {
  return (
    <main className="public-summary">
      <div className="summary-brand"><Stripes /><span>Product Festival</span></div>
      <p className="eyebrow">{event.name}</p>
      <h1>Čo sa dnes stalo.</h1>
      <section className="summary-number-grid">
        <article><strong>{stats?.teamCount ?? 0}</strong><span>produktov</span></article>
        <article><strong>{stats?.visitCount ?? 0}</strong><span>vyskúšaní</span></article>
        <article><strong>{stats?.feedbackCount ?? 0}</strong><span>spätných väzieb</span></article>
        <article><strong>{formatCredits(stats?.totalInvested ?? 0, event.currency)}</strong><span>investícií</span></article>
      </section>
      <p className="summary-note">
        Investícia znamená „chcem vidieť, kam sa toto posunie“. Nie je to poradie
      </p>
    </main>
  );
}
