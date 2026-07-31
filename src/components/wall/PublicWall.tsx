"use client";

import { Stripes } from "@/components/brand/Stripes";
import { formatCredits } from "@/lib/domain/credits";
import type { EventStats, FestivalEvent } from "@/lib/domain/types";
import { MessageSquareText, ScanLine, WalletCards } from "lucide-react";
import { useCountdown } from "./useCountdown";

export function PublicWall({
  event,
  stats,
}: {
  event: FestivalEvent;
  stats: EventStats | null;
}) {
  const countdown = useCountdown(event.locksAt);
  const distributedPercent = stats?.budgetDistributedPercent ?? 0;
  const remainingBudget = stats?.budgetRemaining ?? 0;
  // A stats row without a budget total is either a pre-migration schema (where
  // the missing columns map to zero) or an event with nothing to distribute.
  // Showing "0% · 0 zostáva" on the projector would read as real progress in
  // both cases, so show nothing instead.
  const hasBudget = (stats?.budgetTotal ?? 0) > 0;
  // With a budget, report the same non-organizer pool as the bar above. Without
  // one — a pre-migration row, where every budget column maps to zero — fall
  // back to `totalInvested`, which that schema does populate, rather than
  // stating on the projector that nothing has been invested.
  const investedCredits = hasBudget
    ? (stats?.budgetDistributed ?? 0)
    : (stats?.totalInvested ?? 0);

  return (
    <main className={`public-wall public-wall--${event.status}`} data-updated={stats?.updatedAt}>
      <header className="wall-header">
        <div className="wall-brand">
          <Stripes />
          <span>Product Festival</span>
        </div>
        <div className="wall-live">
          <span />
          {event.status === "open" ? "Prebieha" : event.status === "released" ? "Hotovo" : "Pauza"}
        </div>
      </header>

      <section className="wall-hero">
        <p>{event.name}</p>
        {event.status === "open" ? (
          <>
            <strong className="wall-countdown">{countdown?.label ?? "—"}</strong>
            <h1>Skúšajte produkty.</h1>
          </>
        ) : null}
        {event.status === "draft" ? <h1>Začíname o chvíľu.</h1> : null}
        {event.status === "locked" ? (
          <>
            <h1>Investovanie je uzavreté.</h1>
            <p className="wall-subtitle">Posledná kontrola. Feedback zatiaľ ostáva súkromný.</p>
          </>
        ) : null}
        {event.status === "released" ? (
          <>
            <h1>Feedback je odomknutý.</h1>
            <p className="wall-subtitle">Každý tím ho nájde vo svojom účte.</p>
          </>
        ) : null}
      </section>

      {hasBudget ? (
        <section className="wall-progress">
          <div>
            <div className="wall-progress-copy">
              <span>Rozdelené z celého rozpočtu</span>
              <small>
                <span>{formatCredits(remainingBudget, event.currency)}</span>
                <span>zostáva</span>
              </small>
            </div>
            <strong>{distributedPercent}%</strong>
          </div>
          <div className="wall-progress-track">
            <span style={{ width: `${distributedPercent}%` }} />
          </div>
        </section>
      ) : null}

      <section className="wall-stats">
        <article>
          <ScanLine aria-hidden="true" />
          <strong>{stats?.visitCount ?? 0}</strong>
          <span>vyskúšaní</span>
        </article>
        <article>
          <MessageSquareText aria-hidden="true" />
          <strong>{stats?.feedbackCount ?? 0}</strong>
          <span>feedbackov</span>
        </article>
        <article>
          <WalletCards aria-hidden="true" />
          <strong>{formatCredits(investedCredits, event.currency)}</strong>
          <span>investovaných</span>
        </article>
      </section>
    </main>
  );
}
