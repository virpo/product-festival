"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BonusReceipt } from "@/lib/domain/types";

const CONFETTI_PIECES = Array.from({ length: 30 }, (_, index) => {
  const angle = ((index * 137.508 + 18) * Math.PI) / 180;
  const horizontalDistance = 24 + ((index * 13) % 25);
  const verticalDistance = 20 + ((index * 17) % 28);

  return {
    color: ["cyan", "amber", "coral"][index % 3],
    delay: `${(index % 6) * 28}ms`,
    duration: `${900 + (index % 5) * 90}ms`,
    rotation: `${240 + ((index * 79) % 420)}deg`,
    shape: ["stripe", "dot", "diamond", "spark"][index % 4],
    x: `${(Math.cos(angle) * horizontalDistance).toFixed(1)}vw`,
    y: `${(Math.sin(angle) * verticalDistance + 16).toFixed(1)}vh`,
  };
});

function FestivalConfetti() {
  return (
    <div className="bonus-reveal__confetti" aria-hidden="true">
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          className={`bonus-reveal__confetti-piece bonus-reveal__confetti-piece--${piece.color} bonus-reveal__confetti-piece--${piece.shape}`}
          key={index}
          style={
            {
              "--confetti-delay": piece.delay,
              "--confetti-duration": piece.duration,
              "--confetti-rotation": piece.rotation,
              "--confetti-x": piece.x,
              "--confetti-y": piece.y,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

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
    <>
      <FestivalConfetti />
      <section
        ref={revealRef}
        tabIndex={-1}
        className="bonus-reveal bonus-reveal--celebrating"
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
    </>
  );
}
