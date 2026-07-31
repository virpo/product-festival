export type EventStatus = "draft" | "open" | "locked" | "released";
export type PersonRole = "participant" | "mentor" | "organizer" | "observer";

export type FestivalEvent = {
  id: string;
  name: string;
  slug: string;
  status: EventStatus;
  currency: string;
  walletDefault: number;
  maxPerTeam: number;
  coverageTarget: number;
  opensAt: string | null;
  locksAt: string | null;
  resultsReleasedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Team = {
  id: string;
  eventId: string;
  number: number;
  name: string;
  slug: string;
  code: string;
  description: string;
  productUrl: string | null;
  tableLabel: string;
  color: string;
  archived: boolean;
  createdAt: string;
};

export type PancakePackageDraft = {
  name: string;
  price: number;
  position: number;
};

export type PancakePackage = PancakePackageDraft & {
  id: string;
  eventId: string;
};

export type TeamPancakeSelection = {
  id: string;
  eventId: string;
  teamId: string;
  packageId: string;
  selectedBy: string;
  selectedAt: string;
};

export type Person = {
  id: string;
  eventId: string;
  name: string;
  role: PersonRole;
  walletBudget: number;
  accessCode: string;
  authUserId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export type TeamMember = {
  id: string;
  eventId: string;
  teamId: string;
  personId: string;
};

export type Visit = {
  id: string;
  eventId: string;
  personId: string;
  teamId: string;
  firstVisitedAt: string;
  lastVisitedAt: string;
};

export type Signal = {
  id: string;
  eventId: string;
  investorId: string;
  teamId: string;
  amount: number;
  feedbackText: string;
  audioPath: string | null;
  audioUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SignalInput = Pick<
  Signal,
  "investorId" | "teamId" | "amount" | "feedbackText" | "audioPath"
>;

export type BonusAchievement =
  | "first-spark"
  | "team-joins-in"
  | "first-light"
  | "helpful-spotlight"
  | "curious-explorer"
  | "festival-sweep"
  | "voice-of-the-festival";

export type BonusAward = {
  id: string;
  eventId: string;
  personId: string;
  achievement: BonusAchievement;
  amount: number;
  teamId: string | null;
  createdAt: string;
};

export type BonusReceipt = {
  achievement: BonusAchievement;
  amount: number;
  title: string;
  message: string;
};

export type SignalSaveResult = {
  signal: Signal;
  awards: BonusReceipt[];
};

export type PrivateAwards = {
  awards: BonusAward[];
};

export type RoleParticipation = Record<PersonRole, number>;

export type EventStats = {
  eventId: string;
  peopleCount: number;
  activePeople: number;
  teamCount: number;
  visitCount: number;
  signalCount: number;
  feedbackCount: number;
  recordingCount: number;
  totalInvested: number;
  budgetTotal: number;
  budgetDistributed: number;
  budgetRemaining: number;
  budgetDistributedPercent: number;
  coverageQualifiedPeople: number;
  coveragePercent: number;
  averageCoverage: number;
  roleParticipation: RoleParticipation;
  updatedAt: string;
};

export type FestivalSnapshot = {
  event: FestivalEvent;
  teams: Team[];
  people: Person[];
  teamMembers: TeamMember[];
  visits: Visit[];
  signals: Signal[];
  pancakePackages: PancakePackage[];
  pancakeSelections: TeamPancakeSelection[];
  stats: EventStats | null;
};

export type Coverage = {
  visited: number;
  available: number;
  target: number;
  qualified: boolean;
  percent: number;
};
