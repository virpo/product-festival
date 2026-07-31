import { createDemoSnapshot } from "@/lib/repository/demo-data";
import type { FestivalSnapshot } from "@/lib/domain/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResultsPage from "./page";

const mocks = vi.hoisted(() => ({
  festival: { current: {} as Record<string, unknown> },
  refresh: vi.fn(),
  signOut: vi.fn(),
  selectPancakePackage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/repository/useFestival", () => ({
  useFestival: () => mocks.festival.current,
}));

describe("ResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    const currentPerson = snapshot.people.find(
      (person) => person.id === "person-peter",
    );
    mocks.festival.current = {
      commands: {
        refresh: mocks.refresh,
        signOut: mocks.signOut,
        selectPancakePackage: mocks.selectPancakePackage,
      },
      currentPerson,
      error: null,
      mode: "demo",
      snapshot,
    };
  });

  it("keeps a participant return to the overview around released results", () => {
    const festival = mocks.festival.current as {
      snapshot: FestivalSnapshot;
    };
    festival.snapshot.event.status = "released";

    render(<ResultsPage />);

    expect(
      screen.getByRole("link", { name: "Späť na Prehľad" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getAllByText("35🥞").length).toBeGreaterThan(0);
  });

  it("does not expose the participant receipt before release", () => {
    const festival = mocks.festival.current as {
      snapshot: FestivalSnapshot;
    };
    festival.snapshot.event.status = "locked";

    render(<ResultsPage />);

    expect(
      screen.getByText("Výsledky ešte nie sú odomknuté."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Marek")).not.toBeInTheDocument();
  });

  it("lets a released team member save an affordable package", async () => {
    const user = userEvent.setup();
    const festival = mocks.festival.current as {
      snapshot: FestivalSnapshot;
    };
    festival.snapshot.event.status = "released";
    festival.snapshot.pancakePackages[6].price = 35;
    render(<ResultsPage />);

    await user.click(
      screen.getByRole("button", {
        name: "Vybrať Bryndza + kakaový prášok",
      }),
    );

    expect(mocks.selectPancakePackage).toHaveBeenCalledWith(
      "pancake-package-7",
    );
  });
});
