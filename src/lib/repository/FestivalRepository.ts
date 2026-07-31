import type {
  EventStatus,
  FestivalEvent,
  FestivalSnapshot,
  PancakePackage,
  PancakePackageDraft,
  Person,
  PersonRole,
  SignalInput,
  SignalSaveResult,
  Team,
  TeamPancakeSelection,
} from "@/lib/domain/types";

export type RepositoryMode = "demo" | "supabase";
export type RepositoryConnectionStatus = "connected" | "disconnected";

export type ClaimPersonOptions = {
  takeover?: boolean;
};

export class AccessCodeInUseError extends Error {
  constructor() {
    super("Tento kód sa už používa.");
    this.name = "AccessCodeInUseError";
  }
}

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
  getPrivateBonusTotal(): Promise<number>;
  subscribe(
    listener: () => void,
    connectionListener?: (status: RepositoryConnectionStatus) => void,
  ): () => void;
  claimPerson(
    accessCode: string,
    options?: ClaimPersonOptions,
  ): Promise<Person>;
  signOut(): Promise<void>;
  touchPresence(personId: string): Promise<void>;
  markVisit(teamId: string): Promise<void>;
  upsertSignal(input: SignalInput, audio?: Blob | null): Promise<SignalSaveResult>;
  removeSignal(investorId: string, teamId: string): Promise<void>;
  saveTeam(input: SaveTeamInput): Promise<Team>;
  removeTeam(teamId: string): Promise<void>;
  savePerson(input: SavePersonInput): Promise<Person>;
  removePerson(personId: string): Promise<void>;
  savePancakeCatalog(
    packages: PancakePackageDraft[],
  ): Promise<PancakePackage[]>;
  selectPancakePackage(packageId: string): Promise<TeamPancakeSelection>;
  updateEvent(patch: Partial<FestivalEvent>): Promise<FestivalEvent>;
  advanceEvent(status: EventStatus): Promise<FestivalEvent>;
  resetDemo(): Promise<void>;
};
