import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamPage from "./page";

const mocks = vi.hoisted(() => ({
  code: "LEDGER8",
  festival: { current: {} as Record<string, unknown> },
  getSearchParam: vi.fn(),
  markVisit: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  removeSignal: vi.fn(),
  upsertSignal: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: mocks.code }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => ({ get: mocks.getSearchParam }),
}));

vi.mock("@/lib/repository/useFestival", () => ({
  useFestival: () => mocks.festival.current,
}));

describe("TeamPage participant flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));
    mocks.festival.current = {
      commands: {
        markVisit: mocks.markVisit.mockResolvedValue(undefined),
        refresh: mocks.refresh,
        removeSignal: mocks.removeSignal.mockResolvedValue(undefined),
        upsertSignal: mocks.upsertSignal.mockResolvedValue(undefined),
      },
      connection: { status: "live", stale: false },
      currentPerson: snapshot.people.find(
        (person) => person.id === "person-peter",
      ),
      error: null,
      mode: "demo",
      snapshot,
    };
    mocks.code = "LEDGER8";
    mocks.getSearchParam.mockReturnValue(null);
  });

  it("returns to the overview with a saved-team notice", async () => {
    const user = userEvent.setup();
    render(<TeamPage />);

    await user.type(
      screen.getByLabelText("Napísaná spätná väzba"),
      "Veľmi jasné.",
    );
    await user.click(screen.getByRole("button", { name: "Poslať spätnú väzbu" }));

    await waitFor(() => expect(mocks.upsertSignal).toHaveBeenCalledOnce());
    // The amount travels with the redirect so the overview can confirm the
    // save even when the post-write refresh has not landed yet.
    expect(mocks.push).toHaveBeenCalledWith("/?saved=LEDGER8&amount=10");
  });

  it("returns to the overview after deleting an existing investment", async () => {
    const user = userEvent.setup();
    mocks.code = "PITCH3";
    mocks.getSearchParam.mockImplementation((key: string) =>
      key === "from" ? "overview" : null,
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TeamPage />);

    await user.click(
      screen.getByRole("button", { name: "Odstrániť investíciu" }),
    );

    await waitFor(() => expect(mocks.removeSignal).toHaveBeenCalledOnce());
    expect(mocks.push).toHaveBeenCalledWith("/?removed=PITCH3");
  });
});
