import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  Person,
  PersonRole,
  Signal,
  SignalInput,
  Team,
} from "@/lib/domain/types";

export type RepositoryMode = "demo" | "supabase";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type SaveTeamInput = {
  id?: string;
  name: string;
  number: number;
  code?: string;
  description: string;
  productUrl: string | null;
  tableLabel: string;
  color: string;
};

export type SavePersonInput = {
  id?: string;
  name: string;
  role: PersonRole;
  walletBudget: number;
  accessCode?: string;
  teamId?: string | null;
};

export type FestivalRepository = {
  readonly mode: RepositoryMode;
  getSnapshot(): Promise<FestivalSnapshot>;
  getCurrentPerson(): Promise<Person | null>;
  subscribe(listener: () => void): () => void;
  claimPerson(accessCode: string): Promise<Person>;
  signOut(): Promise<void>;
  touchPresence(personId: string): Promise<void>;
  markVisit(personId: string, teamId: string): Promise<void>;
  upsertSignal(input: SignalInput, audio?: Blob | null): Promise<Signal>;
  removeSignal(investorId: string, teamId: string): Promise<void>;
  saveTeam(input: SaveTeamInput): Promise<Team>;
  removeTeam(teamId: string): Promise<void>;
  savePerson(input: SavePersonInput): Promise<Person>;
  removePerson(personId: string): Promise<void>;
  assignPersonToTeam(personId: string, teamId: string | null): Promise<void>;
  updateEvent(patch: Partial<FestivalEvent>): Promise<FestivalEvent>;
  advanceEvent(status: EventStatus): Promise<FestivalEvent>;
  resetDemo(): Promise<void>;
};
