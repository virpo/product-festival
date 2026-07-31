"use client";

import { formatCredits } from "@/lib/domain/credits";
import {
  teamReceivedAmount,
  validatePancakeCatalog,
} from "@/lib/domain/pancake-market";
import type {
  FestivalSnapshot,
  PancakePackageDraft,
} from "@/lib/domain/types";
import { ArrowDown, ArrowUp, CheckCircle2, Store } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PancakeMarketAdminProps = {
  snapshot: FestivalSnapshot;
  onSave: (packages: PancakePackageDraft[]) => Promise<void>;
};

function sortedDrafts(snapshot: FestivalSnapshot): PancakePackageDraft[] {
  return [...snapshot.pancakePackages]
    .sort((left, right) => left.position - right.position)
    .map(({ name, position, price }) => ({ name, position, price }));
}

function catalogueSignature(packages: readonly PancakePackageDraft[]): string {
  return JSON.stringify(
    [...packages]
      .sort((left, right) => left.position - right.position)
      .map(({ name, position, price }) => ({ name, position, price })),
  );
}

export function PancakeMarketAdmin({
  snapshot,
  onSave,
}: PancakeMarketAdminProps) {
  const persistedDrafts = useMemo(
    () => sortedDrafts(snapshot),
    [snapshot],
  );
  const persistedSignature = catalogueSignature(persistedDrafts);
  const appliedSignature = useRef(persistedSignature);
  const [drafts, setDrafts] = useState(persistedDrafts);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeTeams = [...snapshot.teams]
    .filter((team) => !team.archived)
    .sort((left, right) => left.number - right.number);
  const released = snapshot.event.status === "released";

  useEffect(() => {
    if (!dirty && appliedSignature.current !== persistedSignature) {
      setDrafts(persistedDrafts);
      appliedSignature.current = persistedSignature;
    }
  }, [dirty, persistedDrafts, persistedSignature]);

  function updateDraft(
    index: number,
    patch: Partial<Pick<PancakePackageDraft, "name" | "price">>,
  ) {
    setDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
    setDirty(true);
    setMessage("");
    setError("");
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= drafts.length) return;
    setDrafts((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next.map((item, itemIndex) => ({
        ...item,
        position: itemIndex + 1,
      }));
    });
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function save() {
    setMessage("");
    setError("");
    let normalized: PancakePackageDraft[];
    try {
      normalized = validatePancakeCatalog(drafts);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Nastavenia burzy nie sú platné.",
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(normalized);
      setDrafts(normalized);
      setDirty(false);
      setMessage("Palacinkové balíčky sú uložené.");
    } catch {
      setError("Nastavenia sa nepodarilo uložiť. Skús to znova.");
    } finally {
      setSaving(false);
    }
  }

  if (released) {
    return (
      <section className="admin-market">
        <header className="section-heading">
          <div>
            <p className="eyebrow">Palacinková burza</p>
            <h2>Objednávky tímov</h2>
            <p>Katalóg je po zverejnení výsledkov uzamknutý.</p>
          </div>
          <Store aria-hidden="true" size={28} />
        </header>
        <div className="admin-market-fulfillment">
          {activeTeams.map((team) => {
            const selection = snapshot.pancakeSelections.find(
              (item) => item.teamId === team.id,
            );
            const item = snapshot.pancakePackages.find(
              (candidate) => candidate.id === selection?.packageId,
            );
            const person = snapshot.people.find(
              (candidate) => candidate.id === selection?.selectedBy,
            );
            return (
              <article key={team.id}>
                <div>
                  <span>Tím {team.number}</span>
                  <strong>{team.name}</strong>
                  <small>
                    {formatCredits(
                      teamReceivedAmount(team.id, snapshot),
                      snapshot.event.currency,
                    )}
                  </small>
                </div>
                {selection && item ? (
                  <div className="admin-market-choice">
                    <strong>{item.name}</strong>
                    <span>{formatCredits(item.price, snapshot.event.currency)}</span>
                    <small>
                      Vybral {person?.name ?? "Neznámy človek"} ·{" "}
                      {new Intl.DateTimeFormat("sk-SK", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(selection.selectedAt))}
                    </small>
                  </div>
                ) : (
                  <span className="admin-market-unselected">Zatiaľ nevybrané</span>
                )}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const amountHeading =
    snapshot.event.status === "open"
      ? "Priebežné sumy tímov"
      : snapshot.event.status === "locked"
        ? "Konečné sumy tímov"
        : "Aktuálne sumy tímov";

  return (
    <section className="admin-market">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Palacinková burza</p>
          <h2>Nastavenie ponuky</h2>
          <p>Názvy, ceny a poradie sa uzamknú pri zverejnení výsledkov.</p>
        </div>
        <Store aria-hidden="true" size={28} />
      </header>

      <div className="admin-market-layout">
        <section className="admin-market-totals">
          <h3>{amountHeading}</h3>
          <p>
            {snapshot.event.status === "open"
              ? "Sumy sa počas investovania ešte menia."
              : snapshot.event.status === "locked"
                ? "Investovanie je uzavreté; tieto sumy sú konečné."
                : "Investovanie sa ešte nezačalo."}
          </p>
          <ul aria-label="Sumy tímov">
            {activeTeams.map((team) => (
              <li key={team.id}>
                <span>
                  <small>Tím {team.number}</small>
                  <strong>{team.name}</strong>
                </span>
                <b>
                  {formatCredits(
                    teamReceivedAmount(team.id, snapshot),
                    snapshot.event.currency,
                  )}
                </b>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-market-editor">
          <h3>Balíčky</h3>
          <div className="admin-market-package-list">
            {drafts.map((item, index) => (
              <fieldset key={`${item.position}-${index}`}>
                <legend>Balíček {index + 1}</legend>
                <label>
                  Názov balíčka {index + 1}
                  <input
                    aria-label={`Názov balíčka ${index + 1}`}
                    className="field-input"
                    onChange={(event) =>
                      updateDraft(index, { name: event.target.value })
                    }
                    value={item.name}
                  />
                </label>
                <label>
                  Cena balíčka {index + 1}
                  <input
                    aria-label={`Cena balíčka ${index + 1}`}
                    className="field-input"
                    inputMode="numeric"
                    min="1"
                    onChange={(event) =>
                      updateDraft(index, { price: Number(event.target.value) })
                    }
                    type="number"
                    value={item.price}
                  />
                </label>
                <div className="admin-market-order">
                  <button
                    aria-label={`Posunúť balíček ${index + 1} vyššie`}
                    disabled={index === 0}
                    onClick={() => moveDraft(index, -1)}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Posunúť balíček ${index + 1} nižšie`}
                    disabled={index === drafts.length - 1}
                    onClick={() => moveDraft(index, 1)}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                </div>
              </fieldset>
            ))}
          </div>
          <button
            className="admin-primary"
            disabled={saving}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Ukladám…" : "Uložiť nastavenia burzy"}
          </button>
          <div aria-live="polite" className="admin-market-notice">
            {message ? (
              <p className="is-success">
                <CheckCircle2 aria-hidden="true" size={16} /> {message}
              </p>
            ) : null}
            {error ? <p className="is-error">{error}</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
