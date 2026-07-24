"use client";

import { coverageFor } from "@/lib/domain/stats";
import { remainingWallet } from "@/lib/domain/rules";
import type { FestivalSnapshot, Person } from "@/lib/domain/types";
import {
  ArrowRight,
  MessageSquareText,
  QrCode,
  WalletCards,
} from "lucide-react";
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
  const ownTeam = snapshot.teamMembers.some(
    (membership) => membership.personId === person.id,
  );
  const isOpen = snapshot.event.status === "open";
  const isReleased = snapshot.event.status === "released";

  return (
    <main className="participant-home">
      <section className="participant-welcome">
        <p className="eyebrow">{snapshot.event.name}</p>
        <h1>Ahoj, {person.name}.</h1>
        <p>
          {isOpen
            ? "Vyskúšaj produkt pri stole. Potom naskenuj jeho QR kód a nechaj tímu peniaze aj konkrétny feedback."
            : isReleased
              ? "Festival sa skončil. Tímy už majú svoje investície aj menovitý feedback."
              : "Investovanie je momentálne zatvorené. Tvoje doterajšie odpovede ostávajú uložené."}
        </p>
      </section>

      <Link
        className={`scan-card ${isOpen ? "" : "scan-card--quiet"}`}
        href={isReleased && ownTeam ? "/results" : isOpen ? "/scan" : "/portfolio"}
      >
        <span className="scan-icon">
          {isReleased && ownTeam ? (
            <MessageSquareText aria-hidden="true" />
          ) : isOpen ? (
            <QrCode aria-hidden="true" />
          ) : (
            <WalletCards aria-hidden="true" />
          )}
        </span>
        <span>
          <small>
            {isReleased && ownTeam ? "Tvoj tím" : isOpen ? "Ďalší tím" : "Tvoj prehľad"}
          </small>
          <strong>
            {isReleased && ownTeam
              ? "Otvoriť feedback"
              : isOpen
                ? "Skenovať QR kód"
                : "Pozrieť investície"}
          </strong>
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
