"use client";

import { Stripes } from "@/components/brand/Stripes";
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
  const coverageValue = stats?.coveragePercent ?? 0;

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

      <section className="wall-progress">
        <div>
          <span>Ľudia, ktorí vyskúšali aspoň {event.coverageTarget}% tímov</span>
          <strong>{coverageValue}%</strong>
        </div>
        <div className="wall-progress-track">
          <span style={{ width: `${coverageValue}%` }} />
        </div>
      </section>

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
          <strong>{event.currency}{stats?.totalInvested ?? 0}</strong>
          <span>investovaných</span>
        </article>
      </section>
    </main>
  );
}
