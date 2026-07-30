import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResultsPage from "./page";

const mocks = vi.hoisted(() => ({
  festival: { current: {} as Record<string, unknown> },
  refresh: vi.fn(),
  signOut: vi.fn(),
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
      },
      currentPerson,
      error: null,
      mode: "demo",
      snapshot,
    };
  });

  it("keeps a participant return to the overview around released results", () => {
    const festival = mocks.festival.current as {
      snapshot: ReturnType<typeof createDemoSnapshot>;
    };
    festival.snapshot.event.status = "released";

    render(<ResultsPage />);

    expect(
      screen.getByRole("link", { name: "Späť na Prehľad" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByText("35🥞")).toBeInTheDocument();
  });

  it("does not expose the participant receipt before release", () => {
    const festival = mocks.festival.current as {
      snapshot: ReturnType<typeof createDemoSnapshot>;
    };
    festival.snapshot.event.status = "locked";

    render(<ResultsPage />);

    expect(
      screen.getByText("Výsledky ešte nie sú odomknuté."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Marek")).not.toBeInTheDocument();
  });
});
