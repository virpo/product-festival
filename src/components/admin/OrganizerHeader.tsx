import { FestivalHeader } from "@/components/brand/FestivalHeader";
import type { EventStatus } from "@/lib/domain/types";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";

const statusLabels: Record<EventStatus, string> = {
  draft: "Príprava",
  open: "Investovanie prebieha",
  locked: "Investovanie je uzavreté",
  released: "Výsledky sú odomknuté",
};

type OrganizerHeaderProps = {
  back?: {
    href: string;
    label: string;
  };
  className?: string;
  eventStatus: EventStatus;
  name: string;
  onSignOut(): Promise<void> | void;
};

export function OrganizerHeader({
  back,
  className,
  eventStatus,
  name,
  onSignOut,
}: OrganizerHeaderProps) {
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
    <span className="organizer-header__section">Administrácia</span>
  );

  return (
    <FestivalHeader
      className={className}
      left={left}
      right={
        <div className="organizer-header__controls">
          <span className={`organizer-header__state organizer-header__state--${eventStatus}`}>
            {statusLabels[eventStatus]}
          </span>
          <span className="organizer-header__name">{name}</span>
          <button
            aria-label="Odhlásiť sa"
            className="organizer-header__signout"
            onClick={() => void onSignOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
          </button>
        </div>
      }
    />
  );
}
