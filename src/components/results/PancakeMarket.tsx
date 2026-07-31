"use client";

import { formatCredits } from "@/lib/domain/credits";
import { teamReceivedAmount } from "@/lib/domain/pancake-market";
import type { FestivalSnapshot, Person, Team } from "@/lib/domain/types";
import { CakeSlice, Check, LockKeyhole } from "lucide-react";
import { useState } from "react";

type PancakeMarketProps = {
  snapshot: FestivalSnapshot;
  team: Team;
  viewer: Person;
  onSelect?: (packageId: string) => Promise<void>;
};

export function PancakeMarket({
  snapshot,
  team,
  viewer,
  onSelect,
}: PancakeMarketProps) {
  const [pendingPackageId, setPendingPackageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const packages = [...snapshot.pancakePackages].sort(
    (left, right) => left.position - right.position,
  );
  const selection = snapshot.pancakeSelections.find(
    (item) => item.teamId === team.id,
  );
  const balance = teamReceivedAmount(team.id, snapshot);
  const editable = viewer.role !== "organizer" && Boolean(onSelect);
  const noneAffordable = packages.every((item) => item.price > balance);

  async function handleSelect(packageId: string) {
    if (!onSelect) return;
    setPendingPackageId(packageId);
    setMessage("");
    setError("");
    try {
      await onSelect(packageId);
      setMessage("Výber pre tím je uložený.");
    } catch {
      setError("Výber sa nepodarilo uložiť. Skús to znova.");
    } finally {
      setPendingPackageId(null);
    }
  }

  return (
    <section aria-labelledby="pancake-market-title" className="pancake-market">
      <header className="pancake-market-heading">
        <div>
          <p className="eyebrow">Virpo pozýva</p>
          <h2 id="pancake-market-title">Palacinková burza</h2>
          <p>
            Peter s vami tento týždeň nemohol byť, a tak vás pozýva na
            palacinky. Za tímové 🥞 si vyberte jednu kombináciu.
          </p>
        </div>
        <div className="pancake-market-balance">
          <CakeSlice aria-hidden="true" size={22} />
          <span>Získali ste</span>
          <strong>{formatCredits(balance, snapshot.event.currency)}</strong>
        </div>
      </header>

      {noneAffordable ? (
        <p className="pancake-market-none">
          Tím nemá dosť 🥞 ani na najlacnejší balíček. Celú ponuku si môžete
          pozrieť nižšie.
        </p>
      ) : null}

      {!editable ? (
        <p className="pancake-market-readonly">
          <LockKeyhole aria-hidden="true" size={16} /> Výber tímu je iba na
          čítanie.
        </p>
      ) : null}

      <div className="pancake-market-grid">
        {packages.map((item) => {
          const missing = Math.max(0, item.price - balance);
          const selected = selection?.packageId === item.id;
          return (
            <article
              className={`pancake-market-card${selected ? " is-selected" : ""}`}
              key={item.id}
            >
              <span className="pancake-market-position">#{item.position}</span>
              <h3>{item.name}</h3>
              <strong>{formatCredits(item.price, snapshot.event.currency)}</strong>
              {selected ? (
                <span className="pancake-market-selected">
                  <Check aria-hidden="true" size={16} /> Vybrané pre tím
                </span>
              ) : editable ? (
                <button
                  aria-label={`Vybrať ${item.name}`}
                  className="pancake-market-select"
                  disabled={missing > 0 || pendingPackageId !== null}
                  onClick={() => void handleSelect(item.id)}
                  type="button"
                >
                  {pendingPackageId === item.id
                    ? "Ukladám…"
                    : missing > 0
                      ? `Chýba ${formatCredits(missing, snapshot.event.currency)}`
                      : "Vybrať"}
                </button>
              ) : missing > 0 ? (
                <span className="pancake-market-missing">
                  Chýba {formatCredits(missing, snapshot.event.currency)}
                </span>
              ) : null}
            </article>
          );
        })}
      </div>

      <div aria-live="polite" className="pancake-market-notice">
        {message ? <p className="is-success">{message}</p> : null}
        {error ? <p className="is-error">{error}</p> : null}
      </div>
    </section>
  );
}
