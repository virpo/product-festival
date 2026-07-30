"use client";

import { formatCredits } from "@/lib/domain/credits";
import { remainingWallet } from "@/lib/domain/rules";
import { coverageFor } from "@/lib/domain/stats";
import type { FestivalSnapshot, Person } from "@/lib/domain/types";
import {
  ArrowRight,
  LogOut,
  MessageSquareText,
  Pencil,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { ParticipantDock } from "./ParticipantDock";
import { ParticipantFrame } from "./ParticipantFrame";
import { ProgressMeter } from "./ProgressMeter";
import { Snackbar } from "./Snackbar";

type ParticipantHomeProps = {
  mode?: "demo" | "live" | "supabase";
  notice: string | null;
  onDismissNotice(): void;
  onSignOut(): Promise<void> | void;
  person: Person;
  snapshot: FestivalSnapshot;
};

export function ParticipantHome({
  mode = "live",
  notice,
  onDismissNotice,
  onSignOut,
  person,
  snapshot,
}: ParticipantHomeProps) {
  const coverage = coverageFor(person.id, snapshot);
  const remaining = remainingWallet(person.id, snapshot);
  const signals = snapshot.signals
    .filter((signal) => signal.investorId === person.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const ownTeamId = snapshot.teamMembers.find(
    (membership) => membership.personId === person.id,
  )?.teamId;
  const ownTeam = snapshot.teams.find((team) => team.id === ownTeamId);
  const released = snapshot.event.status === "released";
  const open = snapshot.event.status === "open";
  const scanLabel =
    signals.length === 0 ? "Skenovať QR kód" : "Skenovať ďalší tím";

  return (
    <ParticipantFrame
      bottom={
        <ParticipantDock>
          <div className="overview-dock">
            {open ? (
              <Link className="overview-primary-action" href="/scan">
                <span>
                  <small>Ďalší tím</small>
                  <strong>{scanLabel}</strong>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : released && ownTeam ? (
              <Link className="overview-primary-action" href="/results">
                <span>
                  <small>Feedback je odomknutý</small>
                  <strong>Výsledok môjho tímu</strong>
                </span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </ParticipantDock>
      }
      mode={mode}
      person={person}
      snapshot={snapshot}
    >
      <main className="participant-overview">
        <section className="overview-balance">
          <p className="panel-kicker">Zostáva ti</p>
          <strong>
            {formatCredits(remaining, snapshot.event.currency)}
          </strong>
          <span>
            z {formatCredits(person.walletBudget, snapshot.event.currency)} na
            rozdelenie
          </span>
        </section>

        <ProgressMeter compact coverage={coverage} />

        {released && ownTeam ? (
          <Link
            aria-label={`Výsledok môjho tímu ${ownTeam.name}`}
            className="overview-result-link"
            href="/results"
          >
            <MessageSquareText aria-hidden="true" size={20} />
            <span>
              <small>Výsledok môjho tímu</small>
              <strong>{ownTeam.name}</strong>
            </span>
            <ArrowRight aria-hidden="true" size={20} />
          </Link>
        ) : null}

        <section className="overview-investments">
          <header>
            <h1>Moje investície</h1>
            <span>{signals.length}</span>
          </header>
          {signals.length === 0 ? (
            <div className="overview-empty">Zatiaľ nič.</div>
          ) : (
            <div className="overview-investment-list">
              {signals.map((signal) => {
                const team = snapshot.teams.find(
                  (candidate) => candidate.id === signal.teamId,
                );
                if (!team) return null;

                return (
                  <Link
                    aria-label={`Upraviť ${team.name}`}
                    className="overview-investment"
                    href={`/t/${encodeURIComponent(team.code)}?from=overview`}
                    key={signal.id}
                  >
                    <span
                      aria-hidden="true"
                      className="overview-team-mark"
                      style={{ background: team.color }}
                    />
                    <span className="overview-investment-copy">
                      <strong>{team.name}</strong>
                      <small>
                        {signal.feedbackText || "Hlasový feedback"}
                      </small>
                    </span>
                    <b>
                      {formatCredits(signal.amount, snapshot.event.currency)}
                    </b>
                    {open ? <Pencil aria-hidden="true" size={16} /> : null}
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <button
          className="overview-signout"
          onClick={() => void onSignOut()}
          type="button"
        >
          <LogOut aria-hidden="true" size={15} />
          Odhlásiť sa
        </button>
      </main>
      {notice ? (
        <Snackbar message={notice} onDismiss={onDismissNotice} />
      ) : null}
    </ParticipantFrame>
  );
}
