"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ConnectionState } from "@/lib/repository/repository-context";
import { useFestival } from "@/lib/repository/useFestival";

type ConnectionNoticeProps = {
  connection: ConnectionState;
  onRetry: () => Promise<void>;
  variant?: "app" | "wall";
};

export function ConnectionNotice({
  connection,
  onRetry,
  variant = "app",
}: ConnectionNoticeProps) {
  if (connection.status !== "retrying") {
    return null;
  }

  return (
    <aside
      className={`connection-notice connection-notice--${variant}`}
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

  return (
    <ConnectionNotice
      connection={connection}
      onRetry={commands.refresh}
      variant={variant}
    />
  );
}
