import type {
  BonusAchievement,
  BonusAward,
  BonusReceipt,
  FestivalEvent,
  Person,
  Signal,
  Team,
  TeamMember,
} from "./types";

export type BonusCalculationInput = {
  event: FestivalEvent;
  person: Person;
  teams: Team[];
  teamMembers: TeamMember[];
  signals: Signal[];
  awards: BonusAward[];
  candidate: Signal;
  now: string;
};

const DETAILS: Record<BonusAchievement, { amount: number; title: string; message: string }> = {
  "first-spark": { amount: 5, title: "Prvá iskra!", message: "Tvoj prvý feedback rozžiaril festival." },
  "team-joins-in": { amount: 5, title: "Tím sa pripája!", message: "Tvoj tím práve poslal svoju prvú iskru." },
  "first-light": { amount: 10, title: "Prvé svetlo!", message: "Tvoj feedback otvoril tomuto tímu nový pohľad." },
  "helpful-spotlight": { amount: 10, title: "Pomoc v centre pozornosti!", message: "Tvoj pohľad ide tímu, ktorý ho práve najviac potrebuje." },
  "curious-explorer": { amount: 5, title: "Zvedavý objaviteľ!", message: "Pozrel/a si sa na tri rôzne projekty." },
  "festival-sweep": { amount: 20, title: "Festivalová výprava!", message: "Dal/a si šancu každému cudziemu tímu." },
  "voice-of-the-festival": { amount: 5, title: "Hlas festivalu!", message: "Tvoja prvá hlasová poznámka priniesla feedbacku nový rozmer." },
};

function isMidpoint(event: FestivalEvent, now: string): boolean {
  if (!event.opensAt || !event.locksAt) return false;
  const open = Date.parse(event.opensAt);
  const lock = Date.parse(event.locksAt);
  const current = Date.parse(now);
  return Number.isFinite(open) && Number.isFinite(lock) && lock > open && current >= open + (lock - open) / 2;
}

export function calculateBonusAwards(input: BonusCalculationInput): BonusReceipt[] {
  const { event, person, teams, teamMembers, signals, awards, candidate } = input;
  const ownTeamIds = new Set(teamMembers.filter((member) => member.personId === person.id).map((member) => member.teamId));
  const teammateIds = new Set(teamMembers.filter((member) => ownTeamIds.has(member.teamId)).map((member) => member.personId));
  const foreignTeams = teams.filter((team) => !team.archived && !ownTeamIds.has(team.id));
  const personSignals = signals.filter((signal) => signal.investorId === person.id);
  const personAwards = awards.filter((award) => award.personId === person.id);
  const earned = new Set(personAwards.map((award) => award.achievement));
  const results: BonusReceipt[] = [];
  const add = (achievement: BonusAchievement, teamId?: string) => {
    if (achievement === "helpful-spotlight") {
      if (teamId && personAwards.some((award) => award.achievement === achievement && award.teamId === teamId)) return;
    } else if (earned.has(achievement)) return;
    results.push({ achievement, ...DETAILS[achievement] });
  };

  if (personSignals.length === 0) add("first-spark");
  if (ownTeamIds.size > 0 && !signals.some((signal) => teammateIds.has(signal.investorId))) add("team-joins-in");
  if (!signals.some((signal) => signal.teamId === candidate.teamId)) add("first-light");

  if (isMidpoint(event, input.now)) {
    const counts = foreignTeams.map((team) => ({ teamId: team.id, count: signals.filter((signal) => signal.teamId === team.id).length }));
    const minimum = Math.min(...counts.map((entry) => entry.count));
    if (counts.some((entry) => entry.teamId === candidate.teamId && entry.count === minimum)) add("helpful-spotlight", candidate.teamId);
  }

  const explored = new Set(personSignals.map((signal) => signal.teamId));
  explored.add(candidate.teamId);
  if (explored.size >= 3) add("curious-explorer");
  if (foreignTeams.length > 0 && foreignTeams.every((team) => explored.has(team.id))) add("festival-sweep");
  if (!earned.has("voice-of-the-festival") && !personSignals.some((signal) => Boolean(signal.audioPath)) && Boolean(candidate.audioPath)) add("voice-of-the-festival");
  return results;
}

export function availableWallet(personId: string, person: Person, signals: Signal[], awards: BonusAward[]): number {
  const spent = signals.filter((signal) => signal.investorId === personId).reduce((sum, signal) => sum + signal.amount, 0);
  const earned = awards.filter((award) => award.personId === personId).reduce((sum, award) => sum + award.amount, 0);
  return person.walletBudget + earned - spent;
}
