"use client";

import { remainingWallet } from "@/lib/domain/rules";
import type {
  FestivalSnapshot,
  Person,
  Signal,
  SignalInput,
  Team,
} from "@/lib/domain/types";
import { Check, ExternalLink, Minus, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AudioRecorder } from "./AudioRecorder";

type SignalFormProps = {
  snapshot: FestivalSnapshot;
  person: Person;
  team: Team;
  existingSignal?: Signal | null;
  onSave: (input: SignalInput, audio?: Blob | null) => Promise<void> | void;
};

export function SignalForm({
  snapshot,
  person,
  team,
  existingSignal = null,
  onSave,
}: SignalFormProps) {
  const available = useMemo(
    () => remainingWallet(person.id, snapshot) + (existingSignal?.amount ?? 0),
    [existingSignal?.amount, person.id, snapshot],
  );
  const maximum = Math.min(snapshot.event.maxPerTeam, available);
  const [amount, setAmount] = useState(existingSignal?.amount ?? Math.min(10, maximum));
  const [feedback, setFeedback] = useState(existingSignal?.feedbackText ?? "");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setSafeAmount(value: number) {
    setAmount(Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (!feedback.trim() && !audio && !existingSignal?.audioPath) {
      setError("Pridaj feedback alebo hlasovú poznámku.");
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          investorId: person.id,
          teamId: team.id,
          amount,
          feedbackText: feedback,
          audioPath:
            audio || existingSignal?.audioPath
              ? existingSignal?.audioPath ?? "pending-recording"
              : null,
        },
        audio,
      );
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Feedback sa nepodarilo uložiť.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="signal-form" onSubmit={submit}>
      <div className="team-heading">
        <div>
          <p className="eyebrow">
            Tím {team.number} · {team.tableLabel}
          </p>
          <h1>{team.name}</h1>
          <p>{team.description}</p>
        </div>
        <span className="team-color" style={{ background: team.color }} />
      </div>

      {team.productUrl ? (
        <a
          className="try-product"
          href={team.productUrl}
          rel="noreferrer"
          target="_blank"
        >
          Vyskúšať produkt
          <ExternalLink aria-hidden="true" size={18} />
        </a>
      ) : null}

      <section className="signal-section amount-section">
        <div className="section-heading">
          <div>
            <p className="panel-kicker">Tvoj signál</p>
            <h2>Koľko do toho dáš?</h2>
          </div>
          <span>zostáva {snapshot.event.currency}{available}</span>
        </div>
        <div className="amount-control">
          <button
            aria-label="Odobrať euro"
            onClick={() => setSafeAmount(amount - 1)}
            type="button"
          >
            <Minus aria-hidden="true" />
          </button>
          <label>
            <span className="sr-only">Suma</span>
            <span aria-hidden="true">{snapshot.event.currency}</span>
            <input
              aria-label="Suma"
              inputMode="numeric"
              max={maximum}
              min={0}
              onChange={(event) => setSafeAmount(event.currentTarget.valueAsNumber)}
              step={1}
              type="number"
              value={amount}
            />
          </label>
          <button
            aria-label="Pridať euro"
            onClick={() => setSafeAmount(amount + 1)}
            type="button"
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
        <p className="field-note">
          Maximum pre jeden tím je {snapshot.event.currency}
          {snapshot.event.maxPerTeam}. Nula znamená feedback bez investície.
        </p>
      </section>

      <section className="signal-section">
        <label className="section-heading" htmlFor={`feedback-${team.id}`}>
          <div>
            <p className="panel-kicker">Feedback</p>
            <h2>Čo by mal tím vedieť?</h2>
          </div>
        </label>
        <textarea
          className="field-textarea signal-textarea"
          id={`feedback-${team.id}`}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Čo fungovalo? Kde si sa zasekol? Čo by si skúsil ďalej?"
          rows={5}
          value={feedback}
        />
        <div className="or-divider"><span>alebo</span></div>
        <AudioRecorder onChange={setAudio} value={audio} />
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="save-confirmation" role="status">
          <Check aria-hidden="true" size={18} /> Uložené. Počas festivalu to môžeš
          zmeniť.
        </p>
      ) : null}
      <button className="primary-button signal-submit" disabled={saving} type="submit">
        {saving ? "Ukladám…" : existingSignal ? "Uložiť zmeny" : "Poslať investíciu a feedback"}
      </button>
    </form>
  );
}
