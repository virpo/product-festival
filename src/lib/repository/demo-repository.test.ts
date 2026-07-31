import { describe, expect, it, vi } from "vitest";
import { remainingWallet } from "@/lib/domain/rules";
import { DemoFestivalRepository } from "./demo-repository";
import type { StorageLike } from "./FestivalRepository";

function memoryStorage(): StorageLike {
  const entries = new Map<string, string>();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

describe("DemoFestivalRepository", () => {
  it("claims a person by access code", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());

    const person = await repo.claimPerson("PETER");

    expect(person.name).toBe("Peter");
    await expect(repo.getCurrentPerson()).resolves.toMatchObject({
      id: person.id,
    });
  });

  it("syncs subscribers after a signal", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const listener = vi.fn();
    repo.subscribe(listener);
    const snapshot = await repo.getSnapshot();
    const mentor = snapshot.people.find((person) => person.role === "mentor");
    const team = snapshot.teams[0];

    await repo.upsertSignal({
      investorId: mentor!.id,
      teamId: team.id,
      amount: 17,
      feedbackText: "Clear first step.",
      audioPath: null,
    });

    expect(listener).toHaveBeenCalled();
    await expect(repo.getSnapshot()).resolves.toMatchObject({
      signals: expect.arrayContaining([
        expect.objectContaining({
          investorId: mentor!.id,
          teamId: team.id,
          amount: 17,
        }),
      ]),
    });
  });

  it("upserts one visit per person and team", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("MENTOR");
    const team = (await repo.getSnapshot()).teams[0];

    await repo.markVisit(team.id);
    await repo.markVisit(team.id);

    const visits = (await repo.getSnapshot()).visits.filter(
      (visit) => visit.personId === person.id && visit.teamId === team.id,
    );
    expect(visits).toHaveLength(1);
  });

  it("rejects own-team visits and visits after lock", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("PETER");
    const snapshot = await repo.getSnapshot();
    const ownTeamId = snapshot.teamMembers.find(
      (member) => member.personId === person.id,
    )!.teamId;

    await expect(repo.markVisit(ownTeamId)).rejects.toThrow(
      "Vlastný tím sa do návštev nepočíta.",
    );

    await repo.advanceEvent("locked");
    await expect(repo.markVisit(snapshot.teams[1].id)).rejects.toThrow(
      "Návštevy sa už nezapisujú.",
    );
  });

  it("keeps membership fixed after a person has sent feedback", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const mentor = await repo.claimPerson("MENTOR");
    const snapshot = await repo.getSnapshot();

    await expect(
      repo.savePerson({
        id: mentor.id,
        name: mentor.name,
        role: mentor.role,
        walletBudget: mentor.walletBudget,
        accessCode: mentor.accessCode,
        teamId: snapshot.teams[2].id,
      }),
    ).rejects.toThrow("Tím už nemožno zmeniť po odoslaní spätnej väzby.");
  });

  it("does not remove or demote the current organizer", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const organizer = await repo.claimPerson("ADMIN");

    await expect(repo.removePerson(organizer.id)).rejects.toThrow(
      "Aktuálneho organizátora nemožno odstrániť.",
    );
    await expect(
      repo.savePerson({
        id: organizer.id,
        name: organizer.name,
        role: "participant",
        walletBudget: organizer.walletBudget,
        accessCode: organizer.accessCode,
        teamId: null,
      }),
    ).rejects.toThrow("Aktuálny organizátor musí zostať organizátorom.");
  });

  it("advances the event forward and rejects skipping states", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());

    await expect(repo.advanceEvent("released")).rejects.toThrow(
      "Najprv uzavri investovanie.",
    );
    await repo.advanceEvent("locked");
    await repo.advanceEvent("released");

    expect((await repo.getSnapshot()).event.status).toBe("released");
  });

  it("configures the catalogue before release and freezes it afterward", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const listener = vi.fn();
    repo.subscribe(listener);
    await repo.claimPerson("ADMIN");
    const configured = (await repo.getSnapshot()).pancakePackages.map(
      ({ name, position, price }) => ({
        name,
        position,
        price: position === 6 ? 30 : position === 7 ? 20 : price,
      }),
    );

    await expect(repo.savePancakeCatalog(configured)).resolves.toHaveLength(7);
    expect(
      (await repo.getSnapshot()).pancakePackages.map((item) => item.price),
    ).toEqual([700, 600, 500, 400, 300, 30, 20]);
    expect(listener).toHaveBeenCalled();

    await repo.advanceEvent("locked");
    await repo.advanceEvent("released");
    await expect(repo.savePancakeCatalog(configured)).rejects.toThrow(
      "Palacinková burza je už otvorená.",
    );
  });

  it("keeps one replaceable affordable selection for the member's team", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    await repo.claimPerson("ADMIN");
    const configured = (await repo.getSnapshot()).pancakePackages.map(
      ({ name, position, price }) => ({
        name,
        position,
        price: position === 6 ? 30 : position === 7 ? 20 : price,
      }),
    );
    await repo.savePancakeCatalog(configured);
    await repo.advanceEvent("locked");
    await repo.advanceEvent("released");
    await repo.signOut();
    const peter = await repo.claimPerson("PETER");
    const packages = (await repo.getSnapshot()).pancakePackages;

    await repo.selectPancakePackage(
      packages.find((item) => item.position === 6)!.id,
    );
    await repo.selectPancakePackage(
      packages.find((item) => item.position === 7)!.id,
    );

    expect((await repo.getSnapshot()).pancakeSelections).toEqual([
      expect.objectContaining({
        packageId: packages.find((item) => item.position === 7)!.id,
        selectedBy: peter.id,
        teamId: "team-1",
      }),
    ]);
    await expect(
      repo.selectPancakePackage(
        packages.find((item) => item.position === 5)!.id,
      ),
    ).rejects.toThrow("Tím nemá dosť palaciniek.");
  });

  it("requires a team and restores market defaults on reset", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    await repo.claimPerson("ADMIN");
    await repo.advanceEvent("locked");
    await repo.advanceEvent("released");
    await repo.signOut();
    await repo.claimPerson("MENTOR");

    await expect(
      repo.selectPancakePackage(
        (await repo.getSnapshot()).pancakePackages[6].id,
      ),
    ).rejects.toThrow("Nemáš priradený tím.");

    await repo.resetDemo();
    const reset = await repo.getSnapshot();
    expect(reset.pancakePackages.map((item) => item.price)).toEqual([
      700, 600, 500, 400, 300, 200, 100,
    ]);
    expect(reset.pancakeSelections).toEqual([]);
  });

  it("clears private bonuses when resetting demo data", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("NINA");
    const team = (await repo.getSnapshot()).teams.find((candidate) => candidate.code === "GARDEN4")!;
    await repo.upsertSignal({ investorId: person.id, teamId: team.id, amount: 0, feedbackText: "A useful first look.", audioPath: null });
    expect(await repo.getPrivateBonusTotal()).toBeGreaterThan(0);
    await repo.resetDemo();
    expect(await repo.getPrivateBonusTotal()).toBe(0);
  });

  it("runs the participant flow through edit, lock, and release", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("NINA");
    const team = (await repo.getSnapshot()).teams.find(
      (candidate) => candidate.code === "GARDEN4",
    )!;
    const baselineTotal = (await repo.getSnapshot()).stats!.budgetTotal;
    await repo.markVisit(team.id);

    const firstResult = await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 37,
      feedbackText: "The result makes sense. Shorten the first screen.",
      audioPath: null,
    });
    expect(firstResult.awards.map((award) => award.achievement)).toEqual([
      "first-spark",
      "team-joins-in",
      "first-light",
    ]);
    const editResult = await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 38,
      feedbackText: "The result makes sense. Shorten the first screen.",
      audioPath: null,
    });
    expect(editResult.awards).toEqual([]);

    const openSnapshot = await repo.getSnapshot();
    expect(
      openSnapshot.visits.some(
        (visit) => visit.personId === person.id && visit.teamId === team.id,
      ),
    ).toBe(true);
    expect(
      openSnapshot.signals.find(
        (signal) =>
          signal.investorId === person.id && signal.teamId === team.id,
      ),
    ).toMatchObject({ amount: 38 });
    expect(await repo.getPrivateBonusTotal()).toBe(20);
    expect(openSnapshot.stats!.budgetTotal).toBe(baselineTotal + 20);
    expect(remainingWallet(person.id, openSnapshot) + 20).toBe(82);

    await repo.advanceEvent("locked");
    await expect(
      repo.upsertSignal({
        investorId: person.id,
        teamId: team.id,
        amount: 39,
        feedbackText: "Too late.",
        audioPath: null,
      }),
    ).rejects.toThrow("Investovanie je zatvorené.");

    await repo.advanceEvent("released");
    expect((await repo.getSnapshot()).event.resultsReleasedAt).not.toBeNull();
  });

  it("refuses a wallet below what the person already invested", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("PETER");
    const snapshot = await repo.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;
    await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 40,
      feedbackText: "Committed.",
      audioPath: null,
    });

    const after = await repo.getSnapshot();
    const committed = after.signals
      .filter((signal) => signal.investorId === person.id)
      .reduce((total, signal) => total + signal.amount, 0);
    // Membership freezes after the first signal, so keep the current team.
    const ownTeamId =
      after.teamMembers.find((member) => member.personId === person.id)
        ?.teamId ?? null;

    await expect(
      repo.savePerson({
        id: person.id,
        name: person.name,
        role: person.role,
        walletBudget: committed - 1,
        accessCode: person.accessCode,
        teamId: ownTeamId,
      }),
    ).rejects.toThrow("Rozpočet nemôže byť nižší než už rozdelené kredity.");

    // Equality is still valid: the wallet is exactly spent.
    await expect(
      repo.savePerson({
        id: person.id,
        name: person.name,
        role: person.role,
        walletBudget: committed,
        accessCode: person.accessCode,
        teamId: ownTeamId,
      }),
    ).resolves.toMatchObject({ walletBudget: committed });
  });
  it("lets earned awards cover an organizer wallet reduction", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("NINA");
    const snapshot = await repo.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;

    await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 40,
      feedbackText: "The bonus covers part of this wallet.",
      audioPath: null,
    });

    const after = await repo.getSnapshot();
    const committed = after.signals
      .filter((signal) => signal.investorId === person.id)
      .reduce((total, signal) => total + signal.amount, 0);
    const earned = await repo.getPrivateBonusTotal();
    const ownTeamId =
      after.teamMembers.find((member) => member.personId === person.id)
        ?.teamId ?? null;

    expect(earned).toBeGreaterThan(0);
    await expect(
      repo.savePerson({
        id: person.id,
        name: person.name,
        role: person.role,
        walletBudget: Math.max(0, committed - earned),
        accessCode: person.accessCode,
        teamId: ownTeamId,
      }),
    ).resolves.toMatchObject({
      walletBudget: Math.max(0, committed - earned),
    });
  });

  it("clears the audio url when a recording is removed", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("PETER");
    const snapshot = await repo.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;

    const withAudio = await repo.upsertSignal(
      {
        investorId: person.id,
        teamId: team.id,
        amount: 5,
        feedbackText: "",
        audioPath: "pending-recording",
      },
      new Blob(["recording"], { type: "audio/webm" }),
    );
    expect(withAudio.signal.audioUrl).toBeTruthy();

    const removed = await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 5,
      feedbackText: "Written instead.",
      audioPath: null,
    });

    expect(removed.signal.audioPath).toBeNull();
    expect(removed.signal.audioUrl).toBeNull();
  });

  it("keeps a new recording playable across the post-save refresh", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("PETER");
    const snapshot = await repo.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;

    await repo.upsertSignal(
      {
        investorId: person.id,
        teamId: team.id,
        amount: 5,
        feedbackText: "",
        audioPath: "pending-recording",
      },
      new Blob(["recording"], { type: "audio/webm" }),
    );

    // Every command refreshes through getSnapshot, so the URL has to survive a
    // read — not just the value upsertSignal returned.
    const readBack = (await repo.getSnapshot()).signals.find(
      (signal) =>
        signal.investorId === person.id && signal.teamId === team.id,
    )!;

    expect(readBack.audioUrl).toBeTruthy();
    expect(readBack.audioPath).toBeTruthy();
  });

  it("drops a recording url left behind by an earlier document", async () => {
    const storage = memoryStorage();
    const first = new DemoFestivalRepository(storage);
    const person = await first.claimPerson("PETER");
    const snapshot = await first.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;
    await first.upsertSignal(
      {
        investorId: person.id,
        teamId: team.id,
        amount: 5,
        feedbackText: "",
        audioPath: "pending-recording",
      },
      new Blob(["recording"], { type: "audio/webm" }),
    );

    // A new document: the persisted blob: URL no longer resolves.
    const reloaded = new DemoFestivalRepository(storage);
    const signal = (await reloaded.getSnapshot()).signals.find(
      (candidate) =>
        candidate.investorId === person.id && candidate.teamId === team.id,
    )!;

    expect(signal.audioUrl).toBeNull();
    expect(signal.audioPath).toBeTruthy();
  });

  it("does not resurrect a recording another tab removed", async () => {
    const storage = memoryStorage();
    const tabA = new DemoFestivalRepository(storage);
    const tabB = new DemoFestivalRepository(storage);
    const person = await tabA.claimPerson("PETER");
    const snapshot = await tabA.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;
    const base = {
      investorId: person.id,
      teamId: team.id,
      amount: 5,
      feedbackText: "Written note.",
    };

    await tabA.upsertSignal(
      { ...base, audioPath: "pending-recording" },
      new Blob(["recording"], { type: "audio/webm" }),
    );
    // Tab A holds the live object URL; tab B clears the recording.
    await tabB.upsertSignal({ ...base, audioPath: null });

    const signal = (await tabA.getSnapshot()).signals.find(
      (candidate) =>
        candidate.investorId === person.id && candidate.teamId === team.id,
    )!;

    expect(signal.audioPath).toBeNull();
    expect(signal.audioUrl).toBeNull();
  });

  it("keeps a durable audio url through an amount-only edit", async () => {
    const storage = memoryStorage();
    const seed = new DemoFestivalRepository(storage);
    const person = await seed.claimPerson("PETER");
    const snapshot = await seed.getSnapshot();
    const team = snapshot.teams.find(
      (candidate) =>
        !snapshot.teamMembers.some(
          (membership) =>
            membership.teamId === candidate.id &&
            membership.personId === person.id,
        ),
    )!;
    const created = await seed.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 5,
      feedbackText: "Note.",
      audioPath: "stored/recording.webm",
    });
    // Simulate a stored snapshot whose recording has a durable, non-blob URL.
    const stored = JSON.parse(
      storage.getItem("product-festival:demo:v1")!,
    ) as typeof snapshot;
    stored.signals.find((s) => s.id === created.signal.id)!.audioUrl =
      "https://example.com/recording.webm";
    storage.setItem("product-festival:demo:v1", JSON.stringify(stored));

    const repo = new DemoFestivalRepository(storage);
    await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 9,
      feedbackText: "Note.",
      audioPath: "stored/recording.webm",
    });

    const signal = (await repo.getSnapshot()).signals.find(
      (candidate) => candidate.id === created.signal.id,
    )!;
    expect(signal.audioUrl).toBe("https://example.com/recording.webm");
  });

  it("re-derives stats for a snapshot stored by an earlier release", async () => {
    const storage = memoryStorage();
    const seeded = await new DemoFestivalRepository(storage).getSnapshot();
    // An older release persisted stats without the investment-progress fields.
    const legacyStats = { ...seeded.stats! } as Record<string, unknown>;
    delete legacyStats.budgetTotal;
    delete legacyStats.budgetDistributed;
    delete legacyStats.budgetRemaining;
    delete legacyStats.budgetDistributedPercent;
    storage.setItem(
      "product-festival:demo:v1",
      JSON.stringify({ ...seeded, stats: legacyStats }),
    );

    // A projector opens the wall anonymously and never writes.
    const snapshot = await new DemoFestivalRepository(storage).getSnapshot();

    expect(snapshot.stats?.budgetTotal).toBeGreaterThan(0);
    expect(snapshot.stats?.budgetRemaining).toBeGreaterThan(0);
  });
});
