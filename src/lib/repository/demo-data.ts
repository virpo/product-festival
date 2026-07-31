import { deriveEventStats } from "@/lib/domain/stats";
import type {
  FestivalSnapshot,
  Person,
  Signal,
  Team,
  TeamMember,
  Visit,
} from "@/lib/domain/types";

const teamNames = [
  ["QueueLess", "QUEUE7", "Objednávky bez čakania v rade."],
  ["PitchPal", "PITCH3", "Nácvik pitchu s konkrétnym feedbackom."],
  ["Gardenly", "GARDEN4", "Čo zasadiť a kedy sa o to postarať."],
  ["Ledger Lens", "LEDGER8", "Vysvetlí, kam sa stratili firemné peniaze."],
  ["Study Buddy", "STUDY2", "Učenie z vlastných poznámok."],
  ["Žltá stopa", "STOPA6", "Výlet pripravený podľa času a nálady."],
  ["HomeFix", "FIXIT5", "Z fotky problému k správnemu remeselníkovi."],
  ["Prompt Pantry", "PANTRY9", "Večera z toho, čo už máš doma."],
  ["First Euro", "EURO11", "Prvý reálny predaj pre malý projekt."],
] as const;

const peopleSeed = [
  ["person-peter", "Peter", "participant", 100, "PETER"],
  ["person-ada", "Ada", "participant", 100, "ADA"],
  ["person-nina", "Nina", "participant", 100, "NINA"],
  ["person-jakub", "Jakub", "participant", 100, "JAKUB"],
  ["person-lenka", "Lenka", "participant", 100, "LENKA"],
  ["person-tomas", "Tomáš", "participant", 100, "TOMAS"],
  ["person-sara", "Sára", "participant", 100, "SARA"],
  ["person-miso", "Mišo", "participant", 100, "MISO"],
  ["person-marek", "Marek", "mentor", 100, "MENTOR"],
  ["person-martin", "Martin", "mentor", 100, "MARTIN"],
  ["person-admin", "Organizátor", "organizer", 100, "ADMIN"],
  ["person-guest", "Hosť", "observer", 100, "GUEST"],
] as const;

export function createDemoSnapshot(date = new Date()): FestivalSnapshot {
  const now = date.toISOString();
  const lock = new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const teams: Team[] = teamNames.map(([name, code, description], index) => ({
    id: `team-${index + 1}`,
    eventId: "event-demo",
    number: index + 1,
    name,
    slug: code.toLowerCase(),
    code,
    description,
    productUrl: `https://example.com/?product=${code.toLowerCase()}`,
    tableLabel: `Stôl ${index + 1}`,
    color: ["#62c5c0", "#f5a720", "#ed3b5b"][index % 3],
    archived: false,
    createdAt: now,
  }));
  const people: Person[] = peopleSeed.map(
    ([id, name, role, walletBudget, accessCode]) => ({
      id,
      eventId: "event-demo",
      name,
      role,
      walletBudget,
      accessCode,
      authUserId: null,
      lastSeenAt: role === "organizer" ? now : null,
      createdAt: now,
    }),
  );
  const teamMembers: TeamMember[] = [
    ["person-peter", "team-1"],
    ["person-ada", "team-1"],
    ["person-nina", "team-2"],
    ["person-jakub", "team-3"],
    ["person-lenka", "team-4"],
    ["person-tomas", "team-5"],
    ["person-sara", "team-6"],
    ["person-miso", "team-7"],
  ].map(([personId, teamId], index) => ({
    id: `member-${index + 1}`,
    eventId: "event-demo",
    personId,
    teamId,
  }));
  const visits: Visit[] = [
    ["person-peter", "team-2"],
    ["person-peter", "team-3"],
    ["person-marek", "team-1"],
    ["person-marek", "team-2"],
    ["person-martin", "team-1"],
    ["person-guest", "team-4"],
  ].map(([personId, teamId], index) => ({
    id: `visit-${index + 1}`,
    eventId: "event-demo",
    personId,
    teamId,
    firstVisitedAt: now,
    lastVisitedAt: now,
  }));
  const signals: Signal[] = [
    [
      "person-peter",
      "team-2",
      15,
      "Prvý krok bol jasný. Skrátil by som len vysvetlenie výsledku.",
    ],
    [
      "person-marek",
      "team-1",
      25,
      "Fungovalo to hneď. Chýbal mi odhad, kedy bude objednávka hotová.",
    ],
    [
      "person-martin",
      "team-1",
      10,
      "Skúsil by som ešte jeden test s človekom, ktorý tento problém nepozná.",
    ],
    [
      "person-guest",
      "team-4",
      20,
      "Chcem vidieť automatické rozdelenie jednej nejasnej transakcie.",
    ],
  ].map(([investorId, teamId, amount, feedbackText], index) => ({
    id: `signal-${index + 1}`,
    eventId: "event-demo",
    investorId: String(investorId),
    teamId: String(teamId),
    amount: Number(amount),
    feedbackText: String(feedbackText),
    audioPath: null,
    audioUrl: null,
    createdAt: now,
    updatedAt: now,
  }));
  const snapshot: FestivalSnapshot = {
    event: {
      id: "event-demo",
      name: "AI Build Week Product Festival",
      slug: "ai-build-week",
      status: "open",
      currency: "🥞",
      walletDefault: 100,
      maxPerTeam: 50,
      coverageTarget: 75,
      opensAt: now,
      locksAt: lock,
      resultsReleasedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    teams,
    people,
    teamMembers,
    visits,
    signals,
    stats: null,
  };

  snapshot.stats = deriveEventStats(snapshot, date);
  return snapshot;
}
