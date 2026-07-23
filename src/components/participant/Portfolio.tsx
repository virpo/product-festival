"use client";

import { coverageFor } from "@/lib/domain/stats";
import { remainingWallet } from "@/lib/domain/rules";
import type {
  FestivalSnapshot,
  Person,
  SignalInput,
} from "@/lib/domain/types";
import { Check, Minus, Pencil, Plus, QrCode, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProgressMeter } from "./ProgressMeter";

export type PortfolioCommands = {
  upsertSignal(input: SignalInput): Promise<void>;
  removeSignal(investorId: string, teamId: string): Promise<void>;
};

export function Portfolio({
  snapshot,
  person,
  commands,
}: {
  snapshot: FestivalSnapshot;
  person: Person;
  commands: PortfolioCommands;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState(0);
  const [draftFeedback, setDraftFeedback] = useState("");
  const [error, setError] = useState("");
  const editable = snapshot.event.status === "open";
  const signals = snapshot.signals.filter(
    (signal) => signal.investorId === person.id,
  );
  const coverage = coverageFor(person.id, snapshot);
  const remaining = remainingWallet(person.id, snapshot);

  function startEdit(teamId: string, amount: number, feedback: string) {
    setEditing(teamId);
    setDraftAmount(amount);
    setDraftFeedback(feedback);
    setError("");
  }

  async function save(teamId: string, audioPath: string | null) {
    setError("");
    try {
      await commands.upsertSignal({
        investorId: person.id,
        teamId,
        amount: draftAmount,
        feedbackText: draftFeedback,
        audioPath,
      });
      setEditing(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Zmenu sa nepodarilo uložiť.");
    }
  }

  async function remove(teamId: string, teamName: string) {
    if (!window.confirm(`Odstrániť investíciu a feedback pre ${teamName}?`)) {
      return;
    }
    await commands.removeSignal(person.id, teamId);
  }

  return (
    <main className="portfolio-page">
      <header className="page-heading">
        <p className="eyebrow">Moje investície</p>
        <h1>{snapshot.event.currency}{remaining} zostáva</h1>
        <p>
          {editable
            ? "Sumu aj feedback môžeš meniť až do uzavretia festivalu."
            : "Investovanie je uzavreté. Toto je tvoj finálny prehľad."}
        </p>
      </header>

      <ProgressMeter coverage={coverage} />

      <section className="investment-ledger">
        <div className="ledger-heading">
          <h2>Odoslané</h2>
          <span>{signals.length}</span>
        </div>
        {signals.length === 0 ? (
          <div className="empty-state">
            <p>Zatiaľ si nič neposlal.</p>
            <Link className="secondary-button" href="/scan">
              <QrCode aria-hidden="true" size={18} /> Skenovať prvý tím
            </Link>
          </div>
        ) : (
          signals.map((signal) => {
            const team = snapshot.teams.find((item) => item.id === signal.teamId);
            if (!team) return null;
            const isEditing = editing === team.id;
            const maxAmount = Math.min(
              snapshot.event.maxPerTeam,
              remaining + signal.amount,
            );

            return (
              <article className="ledger-row" key={signal.id}>
                <div className="ledger-team">
                  <span style={{ background: team.color }} />
                  <div>
                    <small>Tím {team.number}</small>
                    <strong>{team.name}</strong>
                  </div>
                </div>
                {isEditing ? (
                  <div className="ledger-editor">
                    <div className="mini-amount">
                      <button
                        aria-label={`Odobrať euro pre ${team.name}`}
                        onClick={() => setDraftAmount(Math.max(0, draftAmount - 1))}
                        type="button"
                      >
                        <Minus aria-hidden="true" size={16} />
                      </button>
                      <label>
                        <span>{snapshot.event.currency}</span>
                        <input
                          aria-label={`Suma pre ${team.name}`}
                          max={maxAmount}
                          min={0}
                          onChange={(event) =>
                            setDraftAmount(
                              Math.max(
                                0,
                                Math.min(maxAmount, event.currentTarget.valueAsNumber || 0),
                              ),
                            )
                          }
                          type="number"
                          value={draftAmount}
                        />
                      </label>
                      <button
                        aria-label={`Pridať euro pre ${team.name}`}
                        onClick={() =>
                          setDraftAmount(Math.min(maxAmount, draftAmount + 1))
                        }
                        type="button"
                      >
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={`portfolio-feedback-${team.id}`}>
                      Feedback pre {team.name}
                    </label>
                    <textarea
                      aria-label={`Feedback pre ${team.name}`}
                      className="field-textarea"
                      id={`portfolio-feedback-${team.id}`}
                      onChange={(event) => setDraftFeedback(event.target.value)}
                      rows={3}
                      value={draftFeedback}
                    />
                    <div className="ledger-editor-actions">
                      <button
                        aria-label={`Zrušiť úpravu ${team.name}`}
                        className="text-button"
                        onClick={() => setEditing(null)}
                        type="button"
                      >
                        <X aria-hidden="true" size={16} /> Zrušiť
                      </button>
                      <button
                        aria-label={`Uložiť ${team.name}`}
                        className="small-primary"
                        onClick={() => void save(team.id, signal.audioPath)}
                        type="button"
                      >
                        <Check aria-hidden="true" size={16} /> Uložiť
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="ledger-feedback">
                      {signal.feedbackText || "Hlasový feedback"}
                    </p>
                    <strong className="ledger-amount">
                      {snapshot.event.currency}{signal.amount}
                    </strong>
                    {editable ? (
                      <div className="ledger-actions">
                        <button
                          aria-label={`Upraviť ${team.name}`}
                          onClick={() =>
                            startEdit(team.id, signal.amount, signal.feedbackText)
                          }
                          type="button"
                        >
                          <Pencil aria-hidden="true" size={16} />
                        </button>
                        <button
                          aria-label={`Odstrániť ${team.name}`}
                          onClick={() => void remove(team.id, team.name)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            );
          })
        )}
      </section>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <Link className="scan-again" href="/scan">
        <QrCode aria-hidden="true" size={21} /> Skenovať ďalší QR kód
      </Link>
    </main>
  );
}
