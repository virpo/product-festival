import type {
  BonusAward,
  FestivalSnapshot,
  Signal,
  SignalInput,
} from "./types";
import { formatCredits } from "./credits";

export class FestivalRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FestivalRuleError";
  }
}

export function remainingWallet(
  personId: string,
  snapshot: FestivalSnapshot,
  awards: BonusAward[] = [],
): number {
  const person = snapshot.people.find((item) => item.id === personId);

  if (!person) {
    return 0;
  }

  const spent = snapshot.signals
    .filter((signal) => signal.investorId === personId)
    .reduce((sum, signal) => sum + signal.amount, 0);
  const earned = awards
    .filter((award) => award.personId === personId)
    .reduce((sum, award) => sum + award.amount, 0);

  return person.walletBudget + earned - spent;
}

export function isOwnTeam(
  personId: string,
  teamId: string,
  snapshot: FestivalSnapshot,
): boolean {
  return snapshot.teamMembers.some(
    (membership) =>
      membership.personId === personId && membership.teamId === teamId,
  );
}

export function validateVisit(
  personId: string,
  teamId: string,
  snapshot: FestivalSnapshot,
) {
  if (snapshot.event.status !== "open") {
    throw new FestivalRuleError("Návštevy sa už nezapisujú.");
  }

  const person = snapshot.people.find((candidate) => candidate.id === personId);
  const team = snapshot.teams.find(
    (candidate) => candidate.id === teamId && !candidate.archived,
  );

  if (!person || !team) {
    throw new FestivalRuleError("Tím alebo človek už nie je dostupný.");
  }

  if (isOwnTeam(personId, teamId, snapshot)) {
    throw new FestivalRuleError("Vlastný tím sa do návštev nepočíta.");
  }

  return team;
}

export function validateTeamAssignment(
  personId: string,
  teamId: string | null | undefined,
  snapshot: FestivalSnapshot,
): void {
  if (teamId === undefined) {
    return;
  }

  if (
    teamId &&
    !snapshot.teams.some((team) => team.id === teamId && !team.archived)
  ) {
    throw new FestivalRuleError("Tím už nie je dostupný.");
  }

  const currentTeamId =
    snapshot.teamMembers.find((member) => member.personId === personId)
      ?.teamId ?? null;

  if (
    currentTeamId !== teamId &&
    snapshot.signals.some((signal) => signal.investorId === personId)
  ) {
    throw new FestivalRuleError(
      "Tím už nemožno zmeniť po odoslaní spätnej väzby.",
    );
  }
}
export function validateSignal(
  input: SignalInput,
  snapshot: FestivalSnapshot,
  awards: BonusAward[] = [],
): SignalInput {
  if (snapshot.event.status !== "open") {
    throw new FestivalRuleError("Investovanie je zatvorené.");
  }

  const investor = snapshot.people.find(
    (person) => person.id === input.investorId,
  );
  const team = snapshot.teams.find(
    (candidate) => candidate.id === input.teamId && !candidate.archived,
  );

  if (!investor || !team) {
    throw new FestivalRuleError("Tím alebo človek už nie je dostupný.");
  }

  if (isOwnTeam(input.investorId, input.teamId, snapshot)) {
    throw new FestivalRuleError("Do vlastného tímu investovať nemôžeš.");
  }

  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new FestivalRuleError("Suma musí byť celé nezáporné číslo.");
  }

  if (input.amount > snapshot.event.maxPerTeam) {
    throw new FestivalRuleError(
      `Do jedného tímu môžeš dať najviac ${formatCredits(
        snapshot.event.maxPerTeam,
        snapshot.event.currency,
      )}.`,
    );
  }

  const hasText = input.feedbackText.trim().length > 0;
  const hasAudio = Boolean(input.audioPath?.trim());

  if (!hasText && !hasAudio) {
    throw new FestivalRuleError("Pridaj text alebo hlasovú poznámku.");
  }

  const existing = snapshot.signals.find(
    (signal) =>
      signal.investorId === input.investorId &&
      signal.teamId === input.teamId,
  );
  const available = remainingWallet(input.investorId, snapshot, awards)
    + (existing?.amount ?? 0);

  if (input.amount > available) {
    throw new FestivalRuleError("Nemáš dosť kreditu.");
  }

  return {
    ...input,
    feedbackText: input.feedbackText.trim(),
    audioPath: input.audioPath?.trim() || null,
  };
}

export function canEditSignal(
  signal: Signal,
  personId: string,
  snapshot: FestivalSnapshot,
): boolean {
  return (
    snapshot.event.status === "open" && signal.investorId === personId
  );
}
