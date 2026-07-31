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
    ).rejects.toThrow("Tím už nemožno zmeniť po odoslaní feedbacku.");
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
});
