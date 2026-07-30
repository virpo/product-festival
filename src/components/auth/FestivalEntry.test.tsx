import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalEntry } from "./FestivalEntry";

const mocks = vi.hoisted(() => ({
  festival: { current: {} as Record<string, unknown> },
  replace: vi.fn(),
  searchParams: { current: {} as Record<string, string> },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({
    get: (key: string) => mocks.searchParams.current[key] ?? null,
  }),
}));

vi.mock("@/lib/repository/useFestival", () => ({
  useFestival: () => mocks.festival.current,
}));

describe("FestivalEntry", () => {
  beforeEach(() => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    mocks.searchParams.current = {};
    mocks.festival.current = {
      commands: {
        refresh: vi.fn(),
        signOut: vi.fn(),
      },
      currentPerson: snapshot.people.find(
        (person) => person.id === "person-peter",
      ),
      error: null,
      mode: "demo",
      snapshot,
    };
  });

  it("renders a participant inside one application frame", () => {
    const { container } = render(<FestivalEntry />);

    expect(container.querySelectorAll(".app-shell")).toHaveLength(1);
    expect(screen.getByText("Peter · účastník")).toBeInTheDocument();
  });

  it("confirms the saved amount even when the refresh has not landed", () => {
    const snapshot = mocks.festival.current.snapshot as ReturnType<
      typeof createDemoSnapshot
    >;
    const team = snapshot.teams[0];
    // The post-write refresh is allowed to fail, so the snapshot may not hold
    // the signal that was just saved.
    snapshot.signals = snapshot.signals.filter(
      (signal) =>
        !(signal.investorId === "person-peter" && signal.teamId === team.id),
    );
    mocks.searchParams.current = { saved: team.code, amount: "30" };

    render(<FestivalEntry />);

    expect(
      screen.getByText(`Uložené pre ${team.name} · 30🥞`),
    ).toBeInTheDocument();
  });

  it("still confirms the save when the amount is missing from the URL", () => {
    const snapshot = mocks.festival.current.snapshot as ReturnType<
      typeof createDemoSnapshot
    >;
    const team = snapshot.teams[0];
    snapshot.signals = snapshot.signals.filter(
      (signal) =>
        !(signal.investorId === "person-peter" && signal.teamId === team.id),
    );
    mocks.searchParams.current = { saved: team.code };

    render(<FestivalEntry />);

    expect(screen.getByText(`Uložené pre ${team.name}`)).toBeInTheDocument();
  });
});
