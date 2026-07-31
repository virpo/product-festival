"use client";

import { useEffect, useRef, useState } from "react";
import type { BonusReceipt } from "@/lib/domain/types";

export function BonusReveal({ awards, currency, onContinue }: { awards: BonusReceipt[]; currency: string; onContinue: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const revealRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const delay = reducedMotion ? 0 : 450 + Math.floor(Math.random() * 400);
    const timer = window.setTimeout(() => setRevealed(true), delay);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    revealRef.current?.focus();
  }, [revealed]);

  if (!revealed) {
    return (
      <section
        ref={revealRef}
        tabIndex={-1}
        className="bonus-reveal bonus-reveal--pending"
        aria-live="polite"
        aria-label="Festivalový bonus"
      >
        <div className="bonus-reveal__spark" aria-hidden="true">✦</div>
        <p className="eyebrow">Festivalová iskra sa odhaľuje…</p>
      </section>
    );
  }
  if (awards.length === 0) return null;
  const total = awards.reduce((sum, award) => sum + award.amount, 0);
  return (
    <section
      ref={revealRef}
      tabIndex={-1}
      className="bonus-reveal"
      aria-live="polite"
      aria-label="Festivalový bonus"
    >
      <div className="bonus-reveal__spark" aria-hidden="true">✦</div>
      <p className="eyebrow">Festivalová iskra</p>
      <h1>+{total} {currency}</h1>
      <p className="bonus-reveal__message">Tvoja spätná väzba práve posunula festival o kúsok ďalej.</p>
      <ul className="bonus-reveal__list">
        {awards.map((award) => (
          <li key={award.achievement}>
            <strong>+{award.amount} {currency}</strong>
            <span>{award.title}</span>
            <small>{award.message}</small>
          </li>
        ))}
      </ul>
      <button className="primary-button" type="button" onClick={onContinue}>Pokračovať</button>
    </section>
  );
}
