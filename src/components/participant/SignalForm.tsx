"use client";

import { formatCredits } from "@/lib/domain/credits";
import { remainingWallet } from "@/lib/domain/rules";
import type {
  FestivalSnapshot,
  Person,
  Signal,
  SignalInput,
  Team,
} from "@/lib/domain/types";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { AudioRecorder } from "./AudioRecorder";
import { ParticipantDock } from "./ParticipantDock";

type SignalFormProps = {
  backHref: string;
  backLabel: string;
  snapshot: FestivalSnapshot;
  person: Person;
  team: Team;
  existingSignal?: Signal | null;
  onDelete?: () => Promise<void> | void;
  onSave(input: SignalInput, audio?: Blob | null): Promise<void> | void;
};

const amountPresets = [5, 10, 25, 50];

export function SignalForm({
  backHref,
  backLabel,
  snapshot,
  person,
  team,
  existingSignal = null,
  onDelete,
  onSave,
}: SignalFormProps) {
  const available = useMemo(
    () => remainingWallet(person.id, snapshot) + (existingSignal?.amount ?? 0),
    [existingSignal?.amount, person.id, snapshot],
  );
  const maximum = Math.min(snapshot.event.maxPerTeam, available);
  const [amount, setAmount] = useState(
    existingSignal?.amount ?? Math.min(10, maximum),
  );
  const [feedback, setFeedback] = useState(existingSignal?.feedbackText ?? "");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [keepExistingAudio, setKeepExistingAudio] = useState(
    Boolean(existingSignal?.audioPath),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The recorded Blob only reaches this form from the recorder's later `stop`
  // event, so saving mid-recording would persist the previous audio path and
  // throw the recording away when navigation unmounts the recorder. Deleting
  // discards the whole signal, so it stays available.
  const [recording, setRecording] = useState(false);
  // Bumped when we navigate away, so a microphone request still waiting on the
  // permission prompt is abandoned instead of capturing into a dead form. A ref
  // rather than state: the recorder has to observe the bump synchronously.
  const cancelTokenRef = useRef(0);
  const readCancelToken = useCallback(() => cancelTokenRef.current, []);

  function setSafeAmount(value: number) {
    setAmount(Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!feedback.trim() && !audio && !keepExistingAudio) {
      setError("Pridaj feedback alebo hlasovú poznámku.");
      return;
    }

    cancelTokenRef.current += 1;
    setSaving(true);
    try {
      await onSave(
        {
          investorId: person.id,
          teamId: team.id,
          amount,
          feedbackText: feedback,
          audioPath: audio
            ? "pending-recording"
            : keepExistingAudio
              ? existingSignal?.audioPath ?? null
              : null,
        },
        audio,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Feedback sa nepodarilo uložiť.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !onDelete ||
      !window.confirm(`Odstrániť investíciu a feedback pre ${team.name}?`)
    ) {
      return;
    }

    cancelTokenRef.current += 1;
    setDeleting(true);
    setError("");
    try {
      await onDelete();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Investíciu sa nepodarilo odstrániť.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className="signal-form" onSubmit={submit}>
      <div className="signal-form__body">
        <header className="signal-team">
          <span
            aria-hidden="true"
            className="signal-team__mark"
            style={{ background: team.color }}
          />
          <div>
            <p className="panel-kicker">
              {existingSignal ? "Upraviť" : `Tím ${team.number}`}
            </p>
            <h1>{team.name}</h1>
          </div>
          {team.productUrl ? (
            <a
              className="signal-product-link"
              href={team.productUrl}
              rel="noreferrer"
              target="_blank"
            >
              Otvoriť produkt
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : null}
        </header>

        <section className="signal-feedback">
          <p className="panel-kicker">Feedback</p>
          <AudioRecorder
            existingUrl={
              keepExistingAudio ? existingSignal?.audioUrl ?? null : null
            }
            readCancelToken={readCancelToken}
            hasExisting={keepExistingAudio}
            onBusyChange={setRecording}
            onChange={setAudio}
            onRemoveExisting={() => setKeepExistingAudio(false)}
            value={audio}
          />
          <label className="signal-write-label" htmlFor={`feedback-${team.id}`}>
            Alebo napíš
          </label>
          <textarea
            aria-label="Napísaný feedback"
            className="field-textarea signal-textarea"
            id={`feedback-${team.id}`}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Čo fungovalo? Čo by si zmenil?"
            rows={3}
            value={feedback}
          />
        </section>

        <section className="signal-amount">
          <div className="signal-section-label">
            <span>Investícia</span>
            <span>
              max {formatCredits(maximum, snapshot.event.currency)}
            </span>
          </div>
          <div className="amount-control">
            <button
              aria-label="Odobrať kredit"
              onClick={() => setSafeAmount(amount - 1)}
              type="button"
            >
              <Minus aria-hidden="true" />
            </button>
            <label>
              <span className="sr-only">Suma</span>
              <input
                aria-label="Suma"
                inputMode="numeric"
                max={maximum}
                min={0}
                onChange={(event) =>
                  setSafeAmount(event.currentTarget.valueAsNumber)
                }
                step={1}
                type="number"
                value={amount}
              />
              <span aria-hidden="true">{snapshot.event.currency}</span>
            </label>
            <button
              aria-label="Pridať kredit"
              onClick={() => setSafeAmount(amount + 1)}
              type="button"
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
          <div className="amount-presets">
            {amountPresets
              .filter((preset) => preset <= maximum)
              .map((preset) => (
                <button
                  aria-label={`Nastaviť ${formatCredits(
                    preset,
                    snapshot.event.currency,
                  )}`}
                  key={preset}
                  onClick={() => setSafeAmount(preset)}
                  type="button"
                >
                  {formatCredits(preset, snapshot.event.currency)}
                </button>
              ))}
          </div>
          <p className="signal-edit-note">
            Môžeš neskôr zmeniť.
          </p>
        </section>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ParticipantDock>
        <div className="signal-dock">
          <div className="signal-dock__row">
            <Link
              aria-label={`Späť na ${backLabel}`}
              className="signal-back"
              href={backHref}
            >
              <ArrowLeft aria-hidden="true" />
            </Link>
            <button
              className="signal-save"
              disabled={saving || deleting || recording}
              type="submit"
            >
              {saving
                ? "Ukladám…"
                : existingSignal
                  ? "Uložiť zmeny"
                  : "Poslať feedback"}
              <ArrowRight aria-hidden="true" size={20} />
            </button>
          </div>
          {recording ? (
            <p className="field-note signal-dock__hint">
              Najprv zastav nahrávanie.
            </p>
          ) : null}
          {existingSignal && onDelete ? (
            <button
              className="signal-delete"
              disabled={saving || deleting}
              onClick={() => void remove()}
              type="button"
            >
              <Trash2 aria-hidden="true" size={16} />
              {deleting ? "Odstraňujem…" : "Odstrániť investíciu"}
            </button>
          ) : null}
        </div>
      </ParticipantDock>
    </form>
  );
}
