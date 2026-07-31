import { describe, expect, it } from "vitest";
import { coverageFor, deriveEventStats } from "./stats";
import { makeSnapshot } from "./rules.test";

const now = "2026-07-24T12:00:00.000Z";

describe("festival stats", () => {
  it("tracks visits separately from signals", () => {
    const snapshot = makeSnapshot({
      visits: [
        {
          id: "visit-1",
          eventId: "event-1",
          personId: "person-2",
          teamId: "team-1",
          firstVisitedAt: now,
          lastVisitedAt: now,
        },
      ],
    });

    expect(coverageFor("person-2", snapshot)).toMatchObject({
      visited: 1,
      available: 2,
      target: 2,
      qualified: false,
    });
  });

  it("derives aggregate stats without team totals", () => {
    const snapshot = makeSnapshot({
      visits: [
        {
          id: "visit-1",
          eventId: "event-1",
          personId: "person-2",
          teamId: "team-1",
          firstVisitedAt: now,
          lastVisitedAt: now,
        },
      ],
      signals: [
        {
          id: "signal-1",
          eventId: "event-1",
          investorId: "person-2",
          teamId: "team-1",
          amount: 25,
          feedbackText: "Clear.",
          audioPath: null,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "signal-2",
          eventId: "event-1",
          investorId: "person-2",
          teamId: "team-2",
          amount: 0,
          feedbackText: "",
          audioPath: "event/person/team.webm",
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const stats = deriveEventStats(snapshot, new Date(now));

    expect(stats).toMatchObject({
      signalCount: 2,
      totalInvested: 25,
      feedbackCount: 2,
      recordingCount: 1,
      visitCount: 1,
    });
    expect(stats).not.toHaveProperty("teamTotals");
  });

  it("tracks how much of the non-organizer budget has been distributed", () => {
    const snapshot = makeSnapshot({
      people: [
        ...makeSnapshot().people,
        {
          id: "person-admin",
          eventId: "event-1",
          name: "Organizátor",
          role: "organizer",
          walletBudget: 100,
          accessCode: "ADMIN",
          authUserId: null,
          lastSeenAt: now,
          createdAt: now,
        },
      ],
      signals: [
        {
          id: "signal-mentor",
          eventId: "event-1",
          investorId: "person-2",
          teamId: "team-1",
          amount: 50,
          feedbackText: "Keep going.",
          audioPath: null,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "signal-organizer",
          eventId: "event-1",
          investorId: "person-admin",
          teamId: "team-1",
          amount: 50,
          feedbackText: "This must not move the public progress.",
          audioPath: null,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(deriveEventStats(snapshot, new Date(now))).toMatchObject({
      budgetTotal: 200,
      budgetDistributed: 50,
      budgetRemaining: 150,
      budgetDistributedPercent: 25,
      totalInvested: 100,
    });
  });

  it("reports 100% only once the budget is actually gone", () => {
    function withDistributed(amount: number) {
      const snapshot = makeSnapshot({
        signals: [
          {
            id: "signal-1",
            eventId: "event-1",
            investorId: "person-2",
            teamId: "team-1",
            amount,
            feedbackText: "Solid.",
            audioPath: null,
            audioUrl: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      return deriveEventStats(snapshot, new Date(now));
    }

    const budgetTotal = withDistributed(0).budgetTotal;

    const almost = withDistributed(budgetTotal - 1);
    expect(almost.budgetRemaining).toBe(1);
    expect(almost.budgetDistributedPercent).toBe(99);

    const complete = withDistributed(budgetTotal);
    expect(complete.budgetRemaining).toBe(0);
    expect(complete.budgetDistributedPercent).toBe(100);
  });
});
