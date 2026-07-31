import { describe, expect, it } from "vitest";
import { calculateBonusAwards } from "./bonuses";
import type { BonusAward, FestivalEvent, Person, Signal, Team, TeamMember } from "./types";

const event: FestivalEvent = {
  id: "event", name: "Festival", slug: "festival", status: "open", currency: "🥞",
  walletDefault: 100, maxPerTeam: 50, coverageTarget: 75,
  opensAt: "2026-07-31T10:00:00.000Z", locksAt: "2026-07-31T12:00:00.000Z",
  resultsReleasedAt: null, createdAt: "2026-07-31T09:00:00.000Z", updatedAt: "2026-07-31T09:00:00.000Z",
};
const person: Person = { id: "person", eventId: "event", name: "Alex", role: "participant", walletBudget: 100, accessCode: "x", authUserId: null, lastSeenAt: null, createdAt: event.createdAt };
const teams: Team[] = [1, 2, 3, 4].map((number) => ({ id: `team-${number}`, eventId: "event", number, name: `Team ${number}`, slug: `team-${number}`, code: `${number}`, description: "", productUrl: null, tableLabel: "", color: "", archived: false, createdAt: event.createdAt }));
const members: TeamMember[] = [{ id: "membership", eventId: "event", teamId: "team-1", personId: "person" }];
const signal = (teamId: string, patch: Partial<Signal> = {}): Signal => ({ id: crypto.randomUUID(), eventId: "event", investorId: "person", teamId, amount: 0, feedbackText: "Helpful", audioPath: null, audioUrl: null, createdAt: event.createdAt, updatedAt: event.createdAt, ...patch });

function calculate(candidate: Signal, signals: Signal[] = [], awards = [], now = "2026-07-31T11:00:00.000Z") {
  return calculateBonusAwards({ event, person, teams, teamMembers: members, signals, awards, candidate, now });
}

describe("festival sparks", () => {
  it("stacks first, team, team-first, and audio achievements", () => {
    const awards = calculate(signal("team-2", { audioPath: "note.webm" }), [], []);
    expect(awards.map((award) => award.achievement)).toEqual([
      "first-spark", "team-joins-in", "first-light", "helpful-spotlight", "voice-of-the-festival",
    ]);
  });

  it("helps all tied zero-review teams after midpoint", () => {
    expect(calculate(signal("team-2"), [], []).some((award) => award.achievement === "helpful-spotlight")).toBe(true);
  });

  it("does not repeat one-time awards or a helped team", () => {
    const awards: BonusAward[] = [
      { id: "a", eventId: "event", personId: "person", achievement: "first-spark", amount: 5, teamId: null, createdAt: event.createdAt },
      { id: "b", eventId: "event", personId: "person", achievement: "helpful-spotlight", amount: 10, teamId: "team-2", createdAt: event.createdAt },
    ];
    const result = calculate(signal("team-2"), [signal("team-3")], awards);
    expect(result.map((award) => award.achievement)).not.toContain("first-spark");
    expect(result.map((award) => award.achievement)).not.toContain("helpful-spotlight");
  });

  it("awards explorer and sweep only across foreign active teams", () => {
    const result = calculate(signal("team-2"), [signal("team-3"), signal("team-4")], [], "2026-07-31T10:30:00.000Z");
    expect(result.map((award) => award.achievement)).toEqual(["first-light", "curious-explorer", "festival-sweep"]);
  });

  it("recognizes a teammate's earlier submission", () => {
    const teammate = { ...signal("team-3"), investorId: "teammate" };
    const teamMembers = [...members, { id: "membership-2", eventId: "event", teamId: "team-1", personId: "teammate" }];
    const result = calculateBonusAwards({
      event, person, teams, teamMembers, signals: [teammate], awards: [],
      candidate: signal("team-2"), now: "2026-07-31T10:30:00.000Z",
    });
    expect(result.map((award) => award.achievement)).not.toContain("team-joins-in");
  });

  it("does not count own or archived teams for sweep", () => {
    const archived = { ...teams[3], id: "team-archived", archived: true };
    const result = calculateBonusAwards({
      event, person, teams: [...teams.slice(0, 3), archived], teamMembers: members,
      signals: [signal("team-3")], awards: [], candidate: signal("team-2"), now: "2026-07-31T10:30:00.000Z",
    });
    expect(result.map((award) => award.achievement)).toContain("festival-sweep");
  });

  it("waits for the midpoint and requires a valid schedule", () => {
    expect(calculate(signal("team-2"), [], [], "2026-07-31T10:59:59.000Z").some((award) => award.achievement === "helpful-spotlight")).toBe(false);
    expect(calculate(signal("team-2"), [], [], "2026-07-31T11:00:00.000Z").some((award) => award.achievement === "helpful-spotlight")).toBe(true);
  });
});
