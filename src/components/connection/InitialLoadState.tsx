"use client";

import { RefreshCw } from "lucide-react";

type InitialLoadStateProps = {
  error: string;
  label: string;
  onRetry: () => Promise<void>;
  variant?: "app" | "wall";
};

export function InitialLoadState({
  error,
  label,
  onRetry,
  variant = "app",
}: InitialLoadStateProps) {
  if (!error) {
    return (
      <main
        className={`initial-load initial-load--${variant}`}
        role="status"
      >
        <span className="initial-load-spinner" />
        <p>{label}</p>
      </main>
    );
  }

  return (
    <main
      className={`initial-load initial-load--${variant} initial-load--error`}
      role="alert"
    >
      <div>
        <h1>Dáta sa nenačítali.</h1>
        <p>{error}</p>
        <button
          onClick={() => {
            void onRetry().catch(() => undefined);
          }}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Skúsiť znova
        </button>
      </div>
    </main>
  );
}
