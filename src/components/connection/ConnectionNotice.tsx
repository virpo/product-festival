"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ConnectionState } from "@/lib/repository/repository-context";
import { useFestival } from "@/lib/repository/useFestival";

type ConnectionNoticeProps = {
  connection: ConnectionState;
  /** Raise the notice above a participant dock and the save snackbar. */
  docked?: boolean;
  onRetry: () => Promise<void>;
  variant?: "app" | "wall";
};

export function ConnectionNotice({
  connection,
  docked = false,
  onRetry,
  variant = "app",
}: ConnectionNoticeProps) {
  if (connection.status !== "retrying") {
    return null;
  }

  return (
    <aside
      className={`connection-notice connection-notice--${variant}${
        docked ? " connection-notice--docked" : ""
      }`}
      role="status"
    >
      <WifiOff aria-hidden="true" size={variant === "wall" ? 22 : 18} />
      <span>{connection.message}</span>
      <button
        onClick={() => {
          void onRetry().catch(() => undefined);
        }}
        type="button"
      >
        <RefreshCw aria-hidden="true" size={16} />
        Obnoviť
      </button>
    </aside>
  );
}

export function FestivalConnectionNotice() {
  const pathname = usePathname();
  const { commands, connection } = useFestival();
  const variant =
    pathname === "/wall" || pathname === "/summary" ? "wall" : "app";
  // Only the participant screens carry the sticky dock and the save snackbar
  // that the notice has to clear. Lifting it on entry, admin or results screens
  // would float it over unrelated content and risk clipping it on a short
  // viewport.
  const docked =
    variant === "app" &&
    (pathname === "/" || pathname === "/scan" || pathname.startsWith("/t/"));

  return (
    <ConnectionNotice
      connection={connection}
      docked={docked}
      onRetry={commands.refresh}
      variant={variant}
    />
  );
}
