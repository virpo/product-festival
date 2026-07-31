"use client";

import { parseTeamCode } from "@/lib/domain/qr";
import { ArrowLeft, ArrowRight, Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ParticipantDock } from "./ParticipantDock";

type Scanner = {
  stop(): Promise<void>;
  clear(): void;
};

async function stopAndClear(scanner: Scanner) {
  try {
    await scanner.stop();
  } catch {
    // stop() throws synchronously when camera startup never completed.
  }

  try {
    scanner.clear();
  } catch {
    // A scanner still changing state will clean itself up after startup.
  }
}

export function QrScanner() {
  const router = useRouter();
  const scannerRef = useRef<Scanner | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [state, setState] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;
        const scanner = new Html5Qrcode("festival-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText) => {
            const code = parseTeamCode(decodedText);
            if (!code) return;
            await scanner.stop();
            scanner.clear();
            router.push(`/t/${encodeURIComponent(code)}`);
          },
          () => undefined,
        );
        if (!active) {
          // Unmounted while the camera was still starting. The cleanup's
          // stop() ran before html5-qrcode left its NOT_STARTED state and was
          // discarded, so this is the only remaining chance to release the
          // camera the start() call just acquired.
          await stopAndClear(scanner);
          return;
        }
        setState("ready");
      } catch {
        if (active) {
          setState("error");
          setError("Kamera sa nedá použiť. Zadaj kód tímu.");
        }
      }
    }

    void start();
    return () => {
      active = false;
      const scanner = scannerRef.current;
      if (scanner) {
        void stopAndClear(scanner);
      }
    };
  }, [router]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const code = parseTeamCode(manualCode);
    if (!code) {
      setError("Zadaj kód tímu.");
      return;
    }
    router.push(`/t/${encodeURIComponent(code)}`);
  }

  return (
    <div className="scanner-flow">
      <main className="scanner-page">
        <header className="scanner-heading">
          <p className="panel-kicker">Skener</p>
          <h1>Naskenuj QR kód</h1>
        </header>
        <section className="scanner-card">
          <div className={`scanner-viewport scanner-viewport--${state}`}>
            <div id="festival-qr-reader" />
            {state === "starting" ? (
              <div className="scanner-placeholder">
                <Camera aria-hidden="true" />
                <span>Zapínam kameru…</span>
              </div>
            ) : null}
            <span className="scan-corner scan-corner--a" />
            <span className="scan-corner scan-corner--b" />
            <span className="scan-corner scan-corner--c" />
            <span className="scan-corner scan-corner--d" />
          </div>
        </section>
        {error ? (
          <p className="form-error scanner-error" role="alert">
            {error}
          </p>
        ) : null}
      </main>

      <ParticipantDock>
        <div className="scanner-dock">
          <Link
            aria-label="Späť na Prehľad"
            className="scanner-back"
            href="/"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
          <form className="scanner-manual" onSubmit={submitManual}>
            <label className="sr-only" htmlFor="manual-team-code">
              Kód tímu
            </label>
            <input
              autoCapitalize="characters"
              autoComplete="off"
              className="field-input"
              id="manual-team-code"
              onChange={(event) =>
                setManualCode(event.target.value.toUpperCase())
              }
              placeholder="KÓD TÍMU"
              value={manualCode}
            />
            <button aria-label="Otvoriť tím" type="submit">
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
        </div>
      </ParticipantDock>
    </div>
  );
}
