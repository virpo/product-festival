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

  it("runs the participant flow through edit, lock, and release", async () => {
    const repo = new DemoFestivalRepository(memoryStorage());
    const person = await repo.claimPerson("PETER");
    const team = (await repo.getSnapshot()).teams.find(
      (candidate) => candidate.code === "LEDGER8",
    )!;

    await repo.markVisit(team.id);
    await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 37,
      feedbackText: "The result makes sense. Shorten the first screen.",
      audioPath: null,
    });
    await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 38,
      feedbackText: "The result makes sense. Shorten the first screen.",
      audioPath: null,
    });

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
    expect(remainingWallet(person.id, openSnapshot)).toBe(47);

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
    expect(withAudio.audioUrl).toBeTruthy();

    const removed = await repo.upsertSignal({
      investorId: person.id,
      teamId: team.id,
      amount: 5,
      feedbackText: "Written instead.",
      audioPath: null,
    });

    expect(removed.audioPath).toBeNull();
    expect(removed.audioUrl).toBeNull();
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
