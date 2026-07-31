import type {
  FestivalSnapshot,
  PancakePackage,
  PancakePackageDraft,
} from "./types";

export const DEFAULT_PANCAKE_PACKAGE_DRAFTS = [
  { position: 1, name: "Nugátová plnka + jahodový kompót", price: 700 },
  { position: 2, name: "Čoko-oriešková plnka + banánová plnka", price: 600 },
  { position: 3, name: "Sladký tvaroh + čerešňový džem", price: 500 },
  { position: 4, name: "Maková plnka + slivkový džem", price: 400 },
  { position: 5, name: "Kávová plnka + tekutý karamel", price: 300 },
  {
    position: 6,
    name: "Gaštanový krém + mandarínkový kompót + šľahačka",
    price: 200,
  },
  { position: 7, name: "Bryndza + kakaový prášok", price: 100 },
] as const satisfies readonly PancakePackageDraft[];

export function validatePancakeCatalog(
  drafts: readonly PancakePackageDraft[],
): PancakePackageDraft[] {
  if (drafts.length !== 7) {
    throw new Error("Presne sedem palacinkových balíčkov je povinných.");
  }

  const normalized = drafts
    .map((item) => ({ ...item, name: item.name.trim() }))
    .sort((left, right) => left.position - right.position);

  if (normalized.some((item) => !item.name)) {
    throw new Error("Názov balíčka nemôže byť prázdny.");
  }

  if (
    normalized.some(
      (item) => !Number.isInteger(item.price) || item.price <= 0,
    )
  ) {
    throw new Error("Cena musí byť kladné celé číslo.");
  }

  if (
    normalized.some((item, index) => item.position !== index + 1)
  ) {
    throw new Error("Poradie musí obsahovať pozície 1 až 7.");
  }

  if (
    normalized.some(
      (item, index) =>
        index > 0 && normalized[index - 1].price <= item.price,
    )
  ) {
    throw new Error("Ceny musia v poradí prísne klesať.");
  }

  return normalized;
}

export function teamReceivedAmount(
  teamId: string,
  snapshot: FestivalSnapshot,
): number {
  return snapshot.signals
    .filter((signal) => signal.teamId === teamId)
    .reduce((total, signal) => total + signal.amount, 0);
}

export function canTeamAffordPackage(
  teamId: string,
  item: PancakePackage,
  snapshot: FestivalSnapshot,
): boolean {
  return (
    item.eventId === snapshot.event.id &&
    item.price <= teamReceivedAmount(teamId, snapshot)
  );
}
