"use client";

import { parseTeamCode } from "@/lib/domain/qr";
import { ArrowRight, Camera, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

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
        if (active) setState("ready");
      } catch {
        if (active) {
          setState("error");
          setError("Kamera sa nedá použiť. Zadaj krátky kód z papiera.");
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
      setError("Zadaj kód tímu z papiera.");
      return;
    }
    router.push(`/t/${encodeURIComponent(code)}`);
  }

  return (
    <main className="scanner-page">
      <header className="page-heading scanner-heading">
        <p className="eyebrow">Ďalší tím</p>
        <h1>Naskenuj QR kód</h1>
        <p>QR nájdeš na stole pri produkte.</p>
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
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="or-divider"><span>alebo</span></div>
        <form className="manual-code" onSubmit={submitManual}>
          <label htmlFor="manual-team-code">
            <Keyboard aria-hidden="true" size={17} /> Kód tímu
          </label>
          <div>
            <input
              autoCapitalize="characters"
              className="field-input"
              id="manual-team-code"
              onChange={(event) => setManualCode(event.target.value.toUpperCase())}
              placeholder="QUEUE7"
              value={manualCode}
            />
            <button aria-label="Otvoriť tím" type="submit">
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
