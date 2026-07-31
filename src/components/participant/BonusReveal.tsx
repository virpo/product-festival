"use client";

import { useEffect, useState } from "react";
import type { BonusReceipt } from "@/lib/domain/types";

export function BonusReveal({ awards, currency, onContinue }: { awards: BonusReceipt[]; currency: string; onContinue: () => void }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const delay = reducedMotion ? 0 : 450 + Math.floor(Math.random() * 650);
    const timer = window.setTimeout(() => setRevealed(true), delay);
    return () => window.clearTimeout(timer);
  }, []);

  if (!revealed) {
    return (
      <section className="bonus-reveal bonus-reveal--pending" aria-live="polite" aria-label="Festivalový bonus">
        <div className="bonus-reveal__spark" aria-hidden="true">✦</div>
        <p className="eyebrow">Festivalová iskra sa odhaľuje…</p>
      </section>
    );
  }
  if (awards.length === 0) return null;
  const total = awards.reduce((sum, award) => sum + award.amount, 0);
  return (
    <section className="bonus-reveal" aria-live="polite" aria-label="Festivalový bonus">
      <div className="bonus-reveal__spark" aria-hidden="true">✦</div>
      <p className="eyebrow">Festivalová iskra</p>
      <h1>+{total} {currency}</h1>
      <p className="bonus-reveal__message">Tvoj feedback práve urobil festival o kúsok lepším.</p>
      <ul className="bonus-reveal__list">
        {awards.map((award) => (
          <li key={award.achievement}>
            <strong>+{award.amount} {currency}</strong>
            <span>{award.title}</span>
            <small>{award.message}</small>
          </li>
        ))}
      </ul>
      <p className="bonus-reveal__handoff">Ukáž túto obrazovku pri Spark stanovišti a vyzdvihni si nálepku.</p>
      <button className="primary-button" type="button" onClick={onContinue}>Pokračovať</button>
    </section>
  );
}
