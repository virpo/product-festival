"use client";

import { coverageFor } from "@/lib/domain/stats";
import { remainingWallet } from "@/lib/domain/rules";
import type { FestivalSnapshot, Person } from "@/lib/domain/types";
import { ArrowRight, QrCode, WalletCards } from "lucide-react";
import Link from "next/link";
import { ProgressMeter } from "./ProgressMeter";

export function ParticipantHome({
  person,
  snapshot,
}: {
  person: Person;
  snapshot: FestivalSnapshot;
}) {
  const coverage = coverageFor(person.id, snapshot);
  const remaining = remainingWallet(person.id, snapshot);

  return (
    <main className="participant-home">
      <section className="participant-welcome">
        <p className="eyebrow">{snapshot.event.name}</p>
        <h1>Ahoj, {person.name}.</h1>
        <p>
          Vyskúšaj produkt pri stole. Potom naskenuj jeho QR kód a nechaj tímu
          peniaze aj konkrétny feedback.
        </p>
      </section>

      <Link className="scan-card" href="/scan">
        <span className="scan-icon"><QrCode aria-hidden="true" /></span>
        <span>
          <small>Ďalší tím</small>
          <strong>Skenovať QR kód</strong>
        </span>
        <ArrowRight aria-hidden="true" />
      </Link>

      <section className="participant-status">
        <div className="wallet-stat">
          <span>Zostáva</span>
          <strong>{snapshot.event.currency}{remaining}</strong>
          <Link href="/portfolio">
            <WalletCards aria-hidden="true" size={17} /> Moje investície
          </Link>
        </div>
        <ProgressMeter coverage={coverage} />
      </section>
    </main>
  );
}
