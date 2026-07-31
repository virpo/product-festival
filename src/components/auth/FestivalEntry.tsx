"use client";

import Link from "next/link";
import { ArrowRight, LogOut, Settings2 } from "lucide-react";
import { AppShell } from "@/components/brand/AppShell";
import { ParticipantHome } from "@/components/participant/ParticipantHome";
import { InitialLoadState } from "@/components/connection/InitialLoadState";
import { formatCredits } from "@/lib/domain/credits";
import { useFestival } from "@/lib/repository/useFestival";
import { useRouter, useSearchParams } from "next/navigation";
import { JoinScreen } from "./JoinScreen";

export function FestivalEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    commands,
    currentPerson,
    error,
    mode,
    privateBonusTotal,
    snapshot,
  } = useFestival();

  if (!snapshot) {
    return (
      <AppShell mode={mode}>
        <InitialLoadState
          error={error}
          label="Pripravujem festival…"
          onRetry={commands.refresh}
        />
      </AppShell>
    );
  }

  if (!currentPerson) {
    return (
      <AppShell mode={mode}>
        <JoinScreen
          mode={mode === "demo" ? "demo" : "live"}
          onJoin={commands.claimPerson}
        />
      </AppShell>
    );
  }

  const savedCode = searchParams.get("saved")?.toUpperCase() ?? null;
  const removedCode = searchParams.get("removed")?.toUpperCase() ?? null;
  const savedTeam = snapshot.teams.find(
    (team) => team.code.toUpperCase() === savedCode,
  );
  const removedTeam = snapshot.teams.find(
    (team) => team.code.toUpperCase() === removedCode,
  );
  const savedSignal = savedTeam
    ? snapshot.signals.find(
        (signal) =>
          signal.investorId === currentPerson.id &&
          signal.teamId === savedTeam.id,
      )
    : null;
  // The saved amount travels in the URL because a write resolves even when its
  // post-write refresh fails. Falling back to the snapshot alone would drop the
  // confirmation entirely on a first save, or show the pre-edit amount on an
  // edit, exactly when the connection is worst.
  // Only a plain non-negative integer is trusted. `Number("")` is 0, so a
  // laxer check would render "· 0🥞" for `?amount=` and defeat the fallback
  // this exists for. Zero itself is a legal amount and stays accepted.
  const savedAmountParam = searchParams.get("amount");
  const parsedAmount =
    savedAmountParam && /^\d+$/.test(savedAmountParam)
      ? Number(savedAmountParam)
      : Number.NaN;
  const savedAmount =
    Number.isSafeInteger(parsedAmount) &&
    parsedAmount <= snapshot.event.maxPerTeam
      ? parsedAmount
      : (savedSignal?.amount ?? null);
  const notice = savedTeam
    ? savedAmount === null
      ? `Uložené pre ${savedTeam.name}`
      : `Uložené pre ${savedTeam.name} · ${formatCredits(
          savedAmount,
          snapshot.event.currency,
        )}`
    : removedTeam
      ? `Investícia pre ${removedTeam.name} odstránená`
      : null;

  if (currentPerson.role !== "organizer") {
    return (
      <ParticipantHome
        mode={mode}
        notice={notice}
        onDismissNotice={() => router.replace("/", { scroll: false })}
        onSignOut={commands.signOut}
        person={currentPerson}
        snapshot={snapshot}
        privateBonusTotal={privateBonusTotal}
      />
    );
  }

  return (
    <AppShell mode={mode}>
      <main className="home-layout">
        <section>
          <p className="eyebrow">{snapshot.event.name}</p>
          <h1>Ahoj, {currentPerson.name}.</h1>
          <p className="lede">
            Festival je {snapshot.event.status === "open" ? "otvorený" : "zatvorený"}.
          </p>
        </section>
        <section className="home-actions">
          <Link className="primary-button" href="/admin">
            <Settings2 aria-hidden="true" size={20} />
            Riadenie festivalu
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <Link className="secondary-button" href="/wall">Otvoriť verejnú stenu</Link>
          <button
            className="text-button"
            onClick={() => void commands.signOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
            Odhlásiť sa
          </button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </main>
    </AppShell>
  );
}
