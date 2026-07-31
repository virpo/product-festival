"use client";

import { formatCredits } from "@/lib/domain/credits";
import type { EventStats, EventStatus, FestivalEvent } from "@/lib/domain/types";
import { CheckCircle2, Clock3, Lock, Play, Radio, Unlock } from "lucide-react";

type OverviewCommands = {
  advanceEvent(status: EventStatus): Promise<void>;
};

const statusLabel: Record<EventStatus, string> = {
  draft: "Príprava",
  open: "Investovanie prebieha",
  locked: "Investovanie je uzavreté",
  released: "Výsledky sú odomknuté",
};

export function EventOverview({
  event,
  stats,
  commands,
}: {
  event: FestivalEvent;
  stats: EventStats | null;
  commands: OverviewCommands;
}) {
  async function advance(status: EventStatus, message: string) {
    if (!window.confirm(message)) return;
    await commands.advanceEvent(status);
  }

  return (
    <section className="admin-overview">
      <div className={`event-state event-state--${event.status}`}>
        <div>
          <Radio aria-hidden="true" size={18} />
          <span>Stav festivalu</span>
        </div>
        <strong>{statusLabel[event.status]}</strong>
      </div>

      <div className="admin-stat-grid">
        <article>
          <span>Tímy</span>
          <strong>{stats?.teamCount ?? 0}</strong>
        </article>
        <article>
          <span>Návštevy</span>
          <strong>{stats?.visitCount ?? 0}</strong>
        </article>
        <article>
          <span>Spätná väzba</span>
          <strong>{stats?.feedbackCount ?? 0}</strong>
        </article>
        <article>
          <span>Investované</span>
          <strong>
            {formatCredits(stats?.totalInvested ?? 0, event.currency)}
          </strong>
        </article>
      </div>

      <div className="lifecycle-card">
        <div>
          <p className="panel-kicker">Ovládanie</p>
          <h2>
            {event.status === "draft" && "Keď sú ľudia a tímy pripravení"}
            {event.status === "open" && "Keď čas vyprší"}
            {event.status === "locked" && "Keď chcete sprístupniť spätnú väzbu"}
            {event.status === "released" && "Festival je uzavretý"}
          </h2>
        </div>
        {event.status === "draft" ? (
          <button
            className="admin-primary"
            onClick={() =>
              void advance("open", "Spustiť investovanie pre všetkých?")
            }
            type="button"
          >
            <Play aria-hidden="true" size={18} /> Spustiť investovanie
          </button>
        ) : null}
        {event.status === "open" ? (
          <button
            className="admin-danger"
            onClick={() =>
              void advance(
                "locked",
                "Uzavrieť investovanie? Ľudia už nebudú môcť meniť svoje odpovede.",
              )
            }
            type="button"
          >
            <Lock aria-hidden="true" size={18} /> Uzavrieť investovanie
          </button>
        ) : null}
        {event.status === "locked" ? (
          <button
            className="admin-primary"
            onClick={() =>
              void advance(
                "released",
                "Sprístupniť tímom ich investície a spätnú väzbu s menami?",
              )
            }
            type="button"
          >
            <Unlock aria-hidden="true" size={18} /> Odomknúť výsledky
          </button>
        ) : null}
        {event.status === "released" ? (
          <span className="lifecycle-done">
            <CheckCircle2 aria-hidden="true" size={18} /> Hotovo
          </span>
        ) : null}
        {event.locksAt && event.status === "open" ? (
          <p className="lifecycle-time">
            <Clock3 aria-hidden="true" size={15} />
            Plánovaný koniec{" "}
            {new Intl.DateTimeFormat("sk-SK", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(event.locksAt))}
          </p>
        ) : null}
      </div>
    </section>
  );
}
