import { describe, expect, it } from "vitest";
import { remainingWallet, validateSignal, validateVisit } from "./rules";
import type { FestivalSnapshot, SignalInput } from "./types";

const now = "2026-07-24T12:00:00.000Z";

export function makeSnapshot(
  overrides: Partial<FestivalSnapshot> = {},
): FestivalSnapshot {
  return {
    event: {
      id: "event-1",
      name: "AI Build Week Product Festival",
      slug: "ai-build-week",
      status: "open",
      currency: "€",
      walletDefault: 100,
      maxPerTeam: 50,
      coverageTarget: 75,
      opensAt: now,
      locksAt: "2026-07-24T15:00:00.000Z",
      resultsReleasedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    teams: [
      {
        id: "team-1",
        eventId: "event-1",
        number: 1,
        name: "QueueLess",
        slug: "queueless",
        code: "QUEUE7",
        description: "Orders without waiting.",
        productUrl: "https://example.com/queue",
        tableLabel: "Stôl 1",
        color: "#62c5c0",
        archived: false,
        createdAt: now,
      },
      {
        id: "team-2",
        eventId: "event-1",
        number: 2,
        name: "PitchPal",
        slug: "pitchpal",
        code: "PITCH3",
        description: "Pitch practice.",
        productUrl: null,
        tableLabel: "Stôl 2",
        color: "#f5a720",
        archived: false,
        createdAt: now,
      },
    ],
    people: [
      {
        id: "person-1",
        eventId: "event-1",
        name: "Peter",
        role: "participant",
        walletBudget: 100,
        accessCode: "PETER",
        authUserId: null,
        lastSeenAt: now,
        createdAt: now,
      },
      {
        id: "person-2",
        eventId: "event-1",
        name: "Marek",
        role: "mentor",
        walletBudget: 100,
        accessCode: "MENTOR",
        authUserId: null,
        lastSeenAt: now,
        createdAt: now,
      },
    ],
    teamMembers: [
      {
        id: "membership-1",
        eventId: "event-1",
        teamId: "team-1",
        personId: "person-1",
      },
    ],
    visits: [],
    signals: [],
    stats: null,
    ...overrides,
  };
}

const validSignal: SignalInput = {
  investorId: "person-2",
  teamId: "team-1",
  amount: 25,
  feedbackText: "The first step was clear.",
  audioPath: null,
};

describe("validateSignal", () => {
  it("rejects an own-team signal", () => {
    const snapshot = makeSnapshot();

    expect(() =>
      validateSignal(
        {
          ...validSignal,
          investorId: "person-1",
        },
        snapshot,
      ),
    ).toThrow("Do vlastného tímu investovať nemôžeš.");
  });

  it("requires feedback text or audio", () => {
    expect(() =>
      validateSignal(
        {
          ...validSignal,
          feedbackText: "  ",
          audioPath: null,
        },
        makeSnapshot(),
      ),
    ).toThrow("Pridaj text alebo hlasovú poznámku.");
  });

  it("allows feedback-only signals", () => {
    const result = validateSignal(
      {
        ...validSignal,
        amount: 0,
        feedbackText: "I got stuck on the first screen.",
      },
      makeSnapshot(),
    );

    expect(result.amount).toBe(0);
  });

  it("rejects overspending", () => {
    const snapshot = makeSnapshot({
      signals: [
        {
          id: "signal-1",
          eventId: "event-1",
          investorId: "person-2",
          teamId: "team-2",
          amount: 80,
          feedbackText: "Useful.",
          audioPath: null,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(() => validateSignal(validSignal, snapshot)).toThrow(
      "Nemáš dosť kreditu.",
    );
  });

  it("rejects writes after lock", () => {
    const snapshot = makeSnapshot({
      event: {
        ...makeSnapshot().event,
        status: "locked",
      },
    });

    expect(() => validateSignal(validSignal, snapshot)).toThrow(
      "Investovanie je zatvorené.",
    );
  });

  it("replaces an existing team amount when checking the wallet", () => {
    const snapshot = makeSnapshot({
      signals: [
        {
          id: "signal-1",
          eventId: "event-1",
          investorId: "person-2",
          teamId: "team-1",
          amount: 25,
          feedbackText: "Useful.",
          audioPath: null,
          audioUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(
      validateSignal({ ...validSignal, amount: 40 }, snapshot).amount,
    ).toBe(40);
    expect(remainingWallet("person-2", snapshot)).toBe(75);
  });
});

describe("validateVisit", () => {
  it("accepts an active, foreign team while investing is open", () => {
    expect(validateVisit("person-2", "team-1", makeSnapshot()).id).toBe(
      "team-1",
    );
  });

  it("rejects own-team and closed-event visits", () => {
    expect(() =>
      validateVisit("person-1", "team-1", makeSnapshot()),
    ).toThrow("Vlastný tím sa do návštev nepočíta.");

    expect(() =>
      validateVisit(
        "person-2",
        "team-1",
        makeSnapshot({
          event: { ...makeSnapshot().event, status: "locked" },
        }),
      ),
    ).toThrow("Návštevy sa už nezapisujú.");
  });
});
