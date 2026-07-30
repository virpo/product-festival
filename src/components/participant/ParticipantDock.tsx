import type { ReactNode } from "react";

export function ParticipantDock({ children }: { children: ReactNode }) {
  return <div className="participant-dock">{children}</div>;
}
