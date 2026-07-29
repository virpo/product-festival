"use client";

import { ArrowRight, Eye, KeyRound, Sparkles, UserRound } from "lucide-react";
import {
  ACCESS_CODE_MAX_LENGTH,
  normalizeAccessCode,
} from "@/lib/domain/access-code";
import {
  AccessCodeInUseError,
  type ClaimPersonOptions,
} from "@/lib/repository/FestivalRepository";
import { useState, type FormEvent } from "react";

type JoinScreenProps = {
  mode: "demo" | "live";
  onJoin: (code: string, options: ClaimPersonOptions) => Promise<void>;
};

const demoEntries = [
  { label: "Účastník", code: "PETER", icon: UserRound },
  { label: "Mentor", code: "MENTOR", icon: Sparkles },
  { label: "Organizátor", code: "ADMIN", icon: KeyRound },
  { label: "Pozorovateľ", code: "GUEST", icon: Eye },
];

export function JoinScreen({ mode, onJoin }: JoinScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [takeoverCode, setTakeoverCode] = useState<string | null>(null);

  async function join(value: string, takeover = false) {
    const normalizedCode = normalizeAccessCode(value);
    setLoading(true);
    setError("");

    try {
      await onJoin(normalizedCode, { takeover });
      setTakeoverCode(null);
    } catch (reason) {
      if (reason instanceof AccessCodeInUseError) {
        setTakeoverCode(normalizedCode);
        setError(reason.message);
      } else {
        setTakeoverCode(null);
        setError(
          reason instanceof Error ? reason.message : "Nepodarilo sa vstúpiť.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void join(code);
  }

  return (
    <main className="join-layout">
      <section className="join-intro">
        <p className="eyebrow">Vitaj na Product Festivale</p>
        <h1>Skús produkty. Nechaj po sebe niečo užitočné.</h1>
        <p className="lede">
          Každý tím má QR kód. Vyskúšaj jeho produkt, investuj a povedz mu,
          čo fungovalo alebo kde si sa zasekol.
        </p>
      </section>

      <section className="join-panel" aria-labelledby="join-title">
        <div>
          <p className="panel-kicker">Tvoj vstup</p>
          <h2 id="join-title">Zadaj prístupový kód</h2>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="access-code">
            Prístupový kód
          </label>
          <div className="join-code-row">
            <input
              autoCapitalize="characters"
              autoComplete="one-time-code"
              id="access-code"
              maxLength={ACCESS_CODE_MAX_LENGTH}
              onChange={(event) => {
                setCode(normalizeAccessCode(event.target.value));
                setTakeoverCode(null);
                setError("");
              }}
              placeholder="napr. PETER"
              required
              value={code}
            />
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {takeoverCode ? (
            <button
              className="secondary-button join-takeover"
              disabled={loading}
              onClick={() => void join(takeoverCode, true)}
              type="button"
            >
              Pokračovať na tomto zariadení
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          ) : null}
          <button
            className="primary-button"
            disabled={loading || code.trim().length === 0}
            type="submit"
          >
            {loading ? "Vstupujem…" : "Vstúpiť"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>

        {mode === "demo" ? (
          <div className="demo-entries">
            <p>Rýchly vstup do demo režimu</p>
            <div>
              {demoEntries.map(({ label, code: demoCode, icon: Icon }) => (
                <button
                  disabled={loading}
                  key={demoCode}
                  onClick={() => void join(demoCode)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
