"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

export function Snackbar({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss(): void;
}) {
  // Parents pass a fresh callback on every render, and realtime invalidations
  // re-render this tree more often than every four seconds during a busy
  // event. Keying the timeout on the callback identity would restart it each
  // time and the snackbar would never dismiss.
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timeout = window.setTimeout(() => dismissRef.current(), 4_000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return (
    <div className="festival-snackbar" role="status">
      <Check aria-hidden="true" size={18} />
      <span>{message}</span>
    </div>
  );
}
