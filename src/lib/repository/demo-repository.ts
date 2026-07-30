import { deriveEventStats } from "@/lib/domain/stats";
import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
  Signal,
  SignalInput,
  Team,
} from "@/lib/domain/types";
import {
  validateSignal,
  validateTeamAssignment,
  validateVisit,
} from "@/lib/domain/rules";
import {
  ACCESS_CODE_MAX_LENGTH,
  normalizeAccessCode,
} from "@/lib/domain/access-code";
import {
  type FestivalRepository,
  type RepositoryConnectionStatus,
  type SavePersonInput,
  type SaveTeamInput,
  type StorageLike,
} from "./FestivalRepository";
import { createDemoSnapshot } from "./demo-data";

const SNAPSHOT_KEY = "product-festival:demo:v1";
const PERSON_KEY = "product-festival:current-person:v1";
const CHANNEL_NAME = "product-festival-demo";

function cloneSnapshot(snapshot: FestivalSnapshot): FestivalSnapshot {
  return structuredClone(snapshot);
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeCode(value: string): string {
  const base = slugify(value).replace(/-/g, "").slice(0, 7).toUpperCase();
  return `${base || "TEAM"}${Math.floor(Math.random() * 90 + 10)}`;
}

function nextState(current: EventStatus): EventStatus | null {
  return (
    {
      draft: "open",
      open: "locked",
      locked: "released",
      released: null,
    } satisfies Record<EventStatus, EventStatus | null>
  )[current];
}

export class DemoFestivalRepository implements FestivalRepository {
  readonly mode = "demo" as const;
  private readonly listeners = new Set<() => void>();
  private readonly channel: BroadcastChannel | null;

  constructor(private readonly storage: StorageLike) {
    this.channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CHANNEL_NAME);
    this.channel?.addEventListener("message", () => this.emit(false));
    this.ensureSnapshot();
  }

  private ensureSnapshot(): FestivalSnapshot {
    const stored = this.storage.getItem(SNAPSHOT_KEY);

    if (stored) {
      try {
        const snapshot = JSON.parse(stored) as FestivalSnapshot;
        // Stored snapshots outlive schema changes: a browser holding demo data
        // from an earlier release carries stats without the newer fields, and
        // an anonymous wall never writes, so nothing would ever recompute
        // them. Deriving on read keeps stored data authoritative for wallets
        // and signals only.
        snapshot.stats = deriveEventStats(snapshot);
        return snapshot;
      } catch {
        this.storage.removeItem(SNAPSHOT_KEY);
      }
    }

    const snapshot = createDemoSnapshot();
    this.storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  private read(): FestivalSnapshot {
    return this.ensureSnapshot();
  }

  private write(snapshot: FestivalSnapshot): FestivalSnapshot {
    const next = cloneSnapshot(snapshot);
    next.stats = deriveEventStats(next);
    this.storage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    this.emit();
    return next;
  }

  private emit(broadcast = true) {
    for (const listener of this.listeners) {
      listener();
    }

    if (broadcast) {
      this.channel?.postMessage({ type: "snapshot-changed" });
    }
  }

  async getSnapshot(): Promise<FestivalSnapshot> {
    return cloneSnapshot(this.read());
  }

  async getCurrentPerson(): Promise<Person | null> {
    const id = this.storage.getItem(PERSON_KEY);
    return this.read().people.find((person) => person.id === id) ?? null;
  }

  subscribe(
    listener: () => void,
    connectionListener?: (status: RepositoryConnectionStatus) => void,
  ): () => void {
    this.listeners.add(listener);
    connectionListener?.("connected");
    return () => this.listeners.delete(listener);
  }

  async claimPerson(accessCode: string): Promise<Person> {
    const normalized = accessCode.trim().toUpperCase();
    const snapshot = this.read();
    const person = snapshot.people.find(
      (candidate) => candidate.accessCode.toUpperCase() === normalized,
    );

    if (!person) {
      throw new Error("Neznámy prístupový kód.");
    }

    person.lastSeenAt = new Date().toISOString();
    this.storage.setItem(PERSON_KEY, person.id);
    this.write(snapshot);
    return structuredClone(person);
  }

  async signOut(): Promise<void> {
    this.storage.removeItem(PERSON_KEY);
    this.emit();
  }

  async touchPresence(personId: string): Promise<void> {
    const snapshot = this.read();
    const person = snapshot.people.find((candidate) => candidate.id === personId);

    if (person) {
      person.lastSeenAt = new Date().toISOString();
      this.write(snapshot);
    }
  }

  async markVisit(teamId: string): Promise<void> {
    const snapshot = this.read();
    const personId = this.storage.getItem(PERSON_KEY);

    if (!personId) {
      throw new Error("Najprv sa prihlás.");
    }

    validateVisit(personId, teamId, snapshot);
    const now = new Date().toISOString();
    const existing = snapshot.visits.find(
      (visit) => visit.personId === personId && visit.teamId === teamId,
    );

    if (existing) {
      existing.lastVisitedAt = now;
    } else {
      snapshot.visits.push({
        id: crypto.randomUUID(),
        eventId: snapshot.event.id,
        personId,
        teamId,
        firstVisitedAt: now,
        lastVisitedAt: now,
      });
    }

    this.write(snapshot);
  }

  async upsertSignal(
    input: SignalInput,
    audio?: Blob | null,
  ): Promise<Signal> {
    const snapshot = this.read();
    const normalized = validateSignal(
      {
        ...input,
        audioPath:
          input.audioPath ??
          (audio ? `demo/${input.investorId}/${input.teamId}.webm` : null),
      },
      snapshot,
    );
    const now = new Date().toISOString();
    const existing = snapshot.signals.find(
      (signal) =>
        signal.investorId === normalized.investorId &&
        signal.teamId === normalized.teamId,
    );

    if (existing) {
      const previousUrl = existing.audioUrl;
      // Follow the path, not the presence of a new blob. Keeping the old URL
      // when `audioPath` is cleared leaves a removed recording playable on the
      // released receipt, which renders from `audioUrl` alone. The Supabase
      // adapter deletes the stored object in the same situation.
      const audioUrl = audio
        ? URL.createObjectURL(audio)
        : normalized.audioPath
          ? previousUrl
          : null;

      if (previousUrl && previousUrl !== audioUrl && previousUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previousUrl);
      }

      Object.assign(existing, normalized, { audioUrl, updatedAt: now });
      this.write(snapshot);
      return structuredClone(existing);
    }

    const signal: Signal = {
      id: crypto.randomUUID(),
      eventId: snapshot.event.id,
      ...normalized,
      audioUrl: audio ? URL.createObjectURL(audio) : null,
      createdAt: now,
      updatedAt: now,
    };
    snapshot.signals.push(signal);
    this.write(snapshot);
    return structuredClone(signal);
  }

  async removeSignal(investorId: string, teamId: string): Promise<void> {
    const snapshot = this.read();

    if (snapshot.event.status !== "open") {
      throw new Error("Investovanie je zatvorené.");
    }

    snapshot.signals = snapshot.signals.filter(
      (signal) =>
        !(signal.investorId === investorId && signal.teamId === teamId),
    );
    this.write(snapshot);
  }

  async saveTeam(input: SaveTeamInput): Promise<Team> {
    const snapshot = this.read();
    const existing = snapshot.teams.find((team) => team.id === input.id);

    if (existing) {
      Object.assign(existing, {
        ...input,
        productUrl: input.productUrl || null,
        code: (input.code || existing.code).trim().toUpperCase(),
        slug: slugify(input.name),
      });
      this.write(snapshot);
      return structuredClone(existing);
    }

    const team: Team = {
      id: crypto.randomUUID(),
      eventId: snapshot.event.id,
      number: input.number,
      name: input.name.trim(),
      slug: slugify(input.name),
      code: (input.code || makeCode(input.name)).trim().toUpperCase(),
      description: input.description.trim(),
      productUrl: input.productUrl || null,
      tableLabel: input.tableLabel.trim(),
      color: input.color,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    snapshot.teams.push(team);
    this.write(snapshot);
    return structuredClone(team);
  }

  async removeTeam(teamId: string): Promise<void> {
    const snapshot = this.read();
    const team = snapshot.teams.find((candidate) => candidate.id === teamId);

    if (!team) {
      return;
    }

    const hasSignals = snapshot.signals.some(
      (signal) => signal.teamId === teamId,
    );

    if (hasSignals) {
      team.archived = true;
    } else {
      snapshot.teams = snapshot.teams.filter((candidate) => candidate.id !== teamId);
      snapshot.teamMembers = snapshot.teamMembers.filter(
        (membership) => membership.teamId !== teamId,
      );
      snapshot.visits = snapshot.visits.filter((visit) => visit.teamId !== teamId);
    }

    this.write(snapshot);
  }

  async savePerson(input: SavePersonInput): Promise<Person> {
    const snapshot = this.read();
    const existing = snapshot.people.find((person) => person.id === input.id);
    const currentPersonId = this.storage.getItem(PERSON_KEY);
    const accessCode = normalizeAccessCode(
      input.accessCode || existing?.accessCode || makeCode(input.name),
    );

    if (accessCode.length > ACCESS_CODE_MAX_LENGTH) {
      throw new Error(
        `Prístupový kód môže mať najviac ${ACCESS_CODE_MAX_LENGTH} znakov.`,
      );
    }

    if (existing) {
      if (
        existing.id === currentPersonId &&
        existing.role === "organizer" &&
        input.role !== "organizer"
      ) {
        throw new Error("Aktuálny organizátor musí zostať organizátorom.");
      }

      if (
        existing.role === "organizer" &&
        input.role !== "organizer" &&
        snapshot.people.filter((person) => person.role === "organizer").length <=
          1
      ) {
        throw new Error("Posledný organizátor musí zostať organizátorom.");
      }

      validateTeamAssignment(existing.id, input.teamId, snapshot);
      Object.assign(existing, {
        name: input.name.trim(),
        role: input.role,
        walletBudget: input.walletBudget,
        accessCode,
      });
      this.assignWithinSnapshot(snapshot, existing.id, input.teamId);
      this.write(snapshot);
      return structuredClone(existing);
    }

    const person: Person = {
      id: crypto.randomUUID(),
      eventId: snapshot.event.id,
      name: input.name.trim(),
      role: input.role,
      walletBudget: input.walletBudget,
      accessCode,
      authUserId: null,
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
    };
    validateTeamAssignment(person.id, input.teamId, snapshot);
    snapshot.people.push(person);
    this.assignWithinSnapshot(snapshot, person.id, input.teamId);
    this.write(snapshot);
    return structuredClone(person);
  }

  async removePerson(personId: string): Promise<void> {
    const snapshot = this.read();
    const person = snapshot.people.find((candidate) => candidate.id === personId);

    if (!person) {
      return;
    }

    if (this.storage.getItem(PERSON_KEY) === personId) {
      throw new Error("Aktuálneho organizátora nemožno odstrániť.");
    }

    if (
      person.role === "organizer" &&
      snapshot.people.filter((candidate) => candidate.role === "organizer")
        .length <= 1
    ) {
      throw new Error("Posledného organizátora nemožno odstrániť.");
    }

    if (snapshot.signals.some((signal) => signal.investorId === personId)) {
      throw new Error("Človeka so spätnou väzbou už nemožno odstrániť.");
    }

    snapshot.people = snapshot.people.filter((person) => person.id !== personId);
    snapshot.teamMembers = snapshot.teamMembers.filter(
      (membership) => membership.personId !== personId,
    );
    snapshot.visits = snapshot.visits.filter(
      (visit) => visit.personId !== personId,
    );
    this.write(snapshot);
  }

  private assignWithinSnapshot(
    snapshot: FestivalSnapshot,
    personId: string,
    teamId: string | null | undefined,
  ) {
    if (teamId === undefined) {
      return;
    }

    snapshot.teamMembers = snapshot.teamMembers.filter(
      (membership) => membership.personId !== personId,
    );

    if (teamId) {
      snapshot.teamMembers.push({
        id: crypto.randomUUID(),
        eventId: snapshot.event.id,
        personId,
        teamId,
      });
    }
  }

  async updateEvent(
    patch: Partial<FestivalEvent>,
  ): Promise<FestivalEvent> {
    const snapshot = this.read();
    snapshot.event = {
      ...snapshot.event,
      ...patch,
      id: snapshot.event.id,
      updatedAt: new Date().toISOString(),
    };
    this.write(snapshot);
    return structuredClone(snapshot.event);
  }

  async advanceEvent(status: EventStatus): Promise<FestivalEvent> {
    const snapshot = this.read();
    const expected = nextState(snapshot.event.status);

    if (expected !== status) {
      const message =
        snapshot.event.status === "open" && status === "released"
          ? "Najprv uzavri investovanie."
          : "Tento krok teraz nie je dostupný.";
      throw new Error(message);
    }

    snapshot.event.status = status;
    snapshot.event.updatedAt = new Date().toISOString();

    if (status === "released") {
      snapshot.event.resultsReleasedAt = snapshot.event.updatedAt;
    }

    this.write(snapshot);
    return structuredClone(snapshot.event);
  }

  async resetDemo(): Promise<void> {
    this.storage.removeItem(SNAPSHOT_KEY);
    this.storage.removeItem(PERSON_KEY);
    this.ensureSnapshot();
    this.emit();
  }
}
