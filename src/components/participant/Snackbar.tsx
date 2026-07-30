"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";

export function Snackbar({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss(): void;
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4_000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div className="festival-snackbar" role="status">
      <Check aria-hidden="true" size={18} />
      <span>{message}</span>
    </div>
  );
}
