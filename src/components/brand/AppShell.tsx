import Link from "next/link";
import type { ReactNode } from "react";
import { Stripes } from "./Stripes";

type AppShellProps = {
  children: ReactNode;
  mode?: "demo" | "live";
};

export function AppShell({ children, mode = "live" }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="brand-lockup" href="/">
          <Stripes size="sm" />
          <span>Product Festival</span>
        </Link>
        {mode === "demo" ? <span className="mode-pill">Demo dáta</span> : null}
      </header>
      <div className="app-content">{children}</div>
    </div>
  );
}
