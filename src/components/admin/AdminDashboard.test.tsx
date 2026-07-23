import type { FestivalContextValueForTests } from "./AdminDashboard";
import { createDemoSnapshot } from "@/lib/repository/demo-data";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminDashboard } from "./AdminDashboard";
import { EventOverview } from "./EventOverview";

function commands() {
  return {
    advanceEvent: vi.fn().mockResolvedValue(undefined),
    assignPersonToTeam: vi.fn().mockResolvedValue(undefined),
    removePerson: vi.fn().mockResolvedValue(undefined),
    removeTeam: vi.fn().mockResolvedValue(undefined),
    resetDemo: vi.fn().mockResolvedValue(undefined),
    savePerson: vi.fn().mockResolvedValue(undefined),
    saveTeam: vi.fn().mockResolvedValue(undefined),
    updateEvent: vi.fn().mockResolvedValue(undefined),
  } satisfies FestivalContextValueForTests["commands"];
}

describe("AdminDashboard", () => {
  const snapshot = createDemoSnapshot(new Date("2026-07-24T10:00:00Z"));

  it("adds a mentor with a custom wallet", async () => {
    const user = userEvent.setup();
    const actions = commands();
    render(<AdminDashboard commands={actions} snapshot={snapshot} />);

    await user.click(screen.getByRole("tab", { name: "Ľudia" }));
    await user.click(screen.getByRole("button", { name: "Pridať človeka" }));
    await user.type(screen.getByLabelText("Meno"), "Valerián");
    await user.selectOptions(screen.getByLabelText("Rola"), "mentor");
    await user.clear(screen.getByLabelText("Kredit"));
    await user.type(screen.getByLabelText("Kredit"), "150");
    await user.click(screen.getByRole("button", { name: "Uložiť človeka" }));

    expect(actions.savePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Valerián",
        role: "mentor",
        walletBudget: 150,
      }),
    );
  });

  it("separates lock and release controls", () => {
    const actions = commands();
    render(
      <EventOverview
        commands={actions}
        event={snapshot.event}
        stats={snapshot.stats}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Uzavrieť investovanie" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Odomknúť výsledky" }),
    ).not.toBeInTheDocument();
  });
});
