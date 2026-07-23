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
});
