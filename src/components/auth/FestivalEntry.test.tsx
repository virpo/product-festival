import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalEntry } from "./FestivalEntry";

const mocks = vi.hoisted(() => ({
  festival: { current: {} as Record<string, unknown> },
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

vi.mock("@/lib/repository/useFestival", () => ({
  useFestival: () => mocks.festival.current,
}));

describe("FestivalEntry", () => {
  beforeEach(() => {
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
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
});
