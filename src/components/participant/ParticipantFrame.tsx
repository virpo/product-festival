import { AppShell } from "@/components/brand/AppShell";
import { FestivalHeader } from "@/components/brand/FestivalHeader";
import { formatCredits } from "@/lib/domain/credits";
import { remainingWallet } from "@/lib/domain/rules";
import type {
  EventStatus,
  FestivalSnapshot,
  Person,
  PersonRole,
} from "@/lib/domain/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const roleLabels: Record<PersonRole, string> = {
  participant: "účastník",
  mentor: "mentor",
  organizer: "organizátor",
  observer: "hosť",
};

const statusLabels: Record<EventStatus, string> = {
  draft: "Príprava",
  open: "Otvorené",
  locked: "Uzavreté",
  released: "Hotovo",
};

type ParticipantFrameProps = {
  back?: {
    href: string;
    label: string;
  };
  bottom?: ReactNode;
  children: ReactNode;
  mode?: "demo" | "live" | "supabase";
  person: Person;
  snapshot: FestivalSnapshot;
};

export function ParticipantFrame({
  back,
  bottom,
  children,
  mode = "live",
  person,
  snapshot,
}: ParticipantFrameProps) {
  const remaining = remainingWallet(person.id, snapshot);
  const left = back ? (
    <Link
      aria-label={`Späť na ${back.label}`}
      className="festival-header__back"
      href={back.href}
    >
      <ArrowLeft aria-hidden="true" size={17} />
      <span>{back.label}</span>
    </Link>
  ) : (
    <span className="festival-header__identity">
      {person.name} · {roleLabels[person.role]}
    </span>
  );
  const right = (
    <div className="festival-header__status">
      {mode === "demo" ? <span className="header-demo-pill">Demo</span> : null}
      {snapshot.event.status === "open" ? (
        <span className="header-balance">
          {formatCredits(remaining, snapshot.event.currency)}
        </span>
      ) : (
        <span className={`header-event-state header-event-state--${snapshot.event.status}`}>
          {statusLabels[snapshot.event.status]}
        </span>
      )}
    </div>
  );

  return (
    <AppShell header={<FestivalHeader left={left} right={right} />} mode={mode}>
      {children}
      {bottom}
    </AppShell>
  );
}
