import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANCAKE_PACKAGE_DRAFTS,
  canTeamAffordPackage,
  teamReceivedAmount,
  validatePancakeCatalog,
} from "./pancake-market";

describe("pancake market", () => {
  it("defines seven descending default tiers", () => {
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item) => item.price)).toEqual([
      700, 600, 500, 400, 300, 200, 100,
    ]);
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS[0].name).toBe(
      "Nugátová plnka + jahodový kompót",
    );
    expect(DEFAULT_PANCAKE_PACKAGE_DRAFTS[6].name).toBe(
      "Bryndza + kakaový prášok",
    );
  });

  it("rejects malformed and non-descending catalogues", () => {
    expect(() => validatePancakeCatalog([])).toThrow("Presne sedem");
    expect(() =>
      validatePancakeCatalog(
        DEFAULT_PANCAKE_PACKAGE_DRAFTS.map((item, index) => ({
          ...item,
          price: index === 1 ? 700 : item.price,
        })),
      ),
    ).toThrow("klesať");
  });

  it("sums received signals and accepts the exact price boundary", () => {
    const snapshot = createDemoSnapshot(new Date("2026-07-31T10:00:00Z"));
    const team = snapshot.teams[0];
    const amount = teamReceivedAmount(team.id, snapshot);
    const exact = { ...snapshot.pancakePackages[0], price: amount };
    const tooExpensive = { ...exact, price: amount + 1 };

    expect(amount).toBe(35);
    expect(canTeamAffordPackage(team.id, exact, snapshot)).toBe(true);
    expect(canTeamAffordPackage(team.id, tooExpensive, snapshot)).toBe(false);
  });
});
